async (page) => {
  const origin = new URL(page.url()).origin;
  const browser = page.context().browser();
  const results = [];
  // Keep the controller idle: only one benchmark page animates at a time.
  await page.goto('about:blank');
  const cases = [
    {name:'ultra-desktop-playing',path:'/',width:1440,height:1000,dpr:2,mode:'playing'},
    {name:'ultra-mobile-playing',path:'/',width:390,height:844,dpr:3,mode:'playing'},
    {name:'ultra-desktop-paused',path:'/',width:1440,height:1000,dpr:2,mode:'paused'},
    {name:'ultra-mobile-news',path:'/',width:390,height:844,dpr:3,mode:'news'},
    {name:'classic-desktop-playing',path:'/classic.html',width:1440,height:1000,dpr:2,mode:'playing'}
  ];
  for (const config of cases) {
    const ctx = await browser.newContext({viewport:{width:config.width,height:config.height},deviceScaleFactor:config.dpr,isMobile:config.width<680,hasTouch:config.width<680});
    const testPage = await ctx.newPage();
    try {
      await testPage.goto(origin+config.path);
      await testPage.waitForFunction(()=>document.querySelectorAll('#county-list li').length===22);
      await testPage.evaluate(()=>document.fonts.ready);
      const classic=config.path.includes('classic');
      if(classic)await testPage.locator('#btn-play').click();
      if(config.mode==='paused')await testPage.locator('#btn-play').click();
      if(config.mode==='news')await testPage.locator('#latest-news').scrollIntoViewIfNeeded();
      await testPage.waitForTimeout(1200);
      await testPage.evaluate(async classic=>{
        const module=await import(classic?'./src/map-renderer.js':'./src/ultra-renderer.js');
        const appModule=await import(classic?'./src/app.js':'./src/ultra-app.js');
        const Renderer=classic?module.TyphoonMapRenderer:module.UltraTyphoonRenderer;
        const App=classic?appModule.App:appModule.UltraApp;
        const stats=window.__perf={renders:0,syncs:0,renderMs:0,canvasPixels:0,particles:0,errors:[]};
        const render=Renderer.prototype.render;
        Renderer.prototype.render=function(...args){
          const t=performance.now();const result=render.apply(this,args);stats.renderMs+=performance.now()-t;stats.renders++;
          stats.canvasPixels=this.canvas.width*this.canvas.height;stats.particles=this.streamlines.length;return result;
        };
        const sync=App.prototype.sync;
        App.prototype.sync=function(...args){stats.syncs++;return sync.apply(this,args)};
        const canvas=document.querySelector('canvas');stats.canvasPixels=canvas.width*canvas.height;
        window.addEventListener('error',event=>stats.errors.push(event.message));
      },classic);
      const cdp=await ctx.newCDPSession(testPage);
      await cdp.send('Performance.enable',{timeDomain:'timeTicks'});
      const getMetrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
      const before=await getMetrics();const started=Date.now();
      await testPage.waitForTimeout(6000);
      const after=await getMetrics();const elapsed=(Date.now()-started)/1000;
      const stats=await testPage.evaluate(()=>window.__perf);
      results.push({case:config.name,elapsedSeconds:elapsed,mainThreadMsPerSecond:1000*(after.TaskDuration-before.TaskDuration)/elapsed,scriptMsPerSecond:1000*(after.ScriptDuration-before.ScriptDuration)/elapsed,layoutMsPerSecond:1000*(after.LayoutDuration-before.LayoutDuration)/elapsed,styleMsPerSecond:1000*(after.RecalcStyleDuration-before.RecalcStyleDuration)/elapsed,rendersPerSecond:stats.renders/elapsed,syncsPerSecond:stats.syncs/elapsed,renderJsMsPerSecond:stats.renderMs/elapsed,canvasPixels:stats.canvasPixels,particles:stats.particles,errors:stats.errors});
      await cdp.detach();
    } finally {await ctx.close();}
  }
  return {origin,browserVersion:browser.version(),results};
}
