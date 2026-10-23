// [RJ] for TY_NEWS.html, W23.html
// Update: 2026-10-23 09:52:05
var DataPath = 'typhoon/TY_NEWS/';
var TY_DataTime = '202610230000';
var TY_COUNT = [1,1];
var TY_TIME = {'C':'民國115年10月23日08時','E':'2026/10/23 00:00 UTC'};
var TYPHOON = {
	'CHAMPI':{'Name':{'C':'薔琵','E':'CHAMPI'}},
	'TD34':{'Name':{'C':'TD34','E':'TD34'}}
};
var TY_LIST_1 = new Array();
var TY_LIST_2 = new Array();
TY_LIST_1['C'] = ''+
    '<div class="panel panel-default" id="CHAMPI">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A1" title="點此展開" aria-expanded="true">'+
                    '<span class="fa-red">中度颱風</span><span class="fa-blue">薔琵</span><br>編號第 29 號<br>國際命名 CHAMPI'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<p>23日8時的中心位置在北緯 22.6 度，東經 123.9 度，以每小時19公里速度，向北北西進行。<span class="fa-blue">中心氣壓</span><span class="fa-red">945</span><span class="fa-blue">百帕</span>，<span class="fa-blue">近中心最大風速每秒</span><span class="fa-red">43</span><span class="fa-blue">公尺</span>，瞬間最大陣風每秒 53 公尺，七級風平均暴風半徑 320 公里(西北側 330 公里、東北側 350 公里、西南側 270 公里、東南側 310 公里)，十級風平均暴風半徑 120 公里(西北側 120 公里、東北側 120 公里、西南側 120 公里、東南側 120 公里)。</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default" id="TD34">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A2" title="點此展開" aria-expanded="false">'+
                    '<span class="fa-red">熱帶性低氣壓</span><span class="fa-blue">TD34</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<p>23日8時的中心位置在北緯 11.0 度，東經 166.5 度，以每小時5公里速度，向西南進行。<span class="fa-blue">中心氣壓</span><span class="fa-red">1004</span><span class="fa-blue">百帕</span>，<span class="fa-blue">近中心最大風速每秒</span><span class="fa-red">15</span><span class="fa-blue">公尺</span>，瞬間最大陣風每秒 23 公尺。</p>'+
            '</div>'+
        '</div>'+
    '</div>';
TY_LIST_2['C'] = ''+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B1" title="點此展開" aria-expanded="true">'+
                    '<span class="fa-red">中度颱風</span><span class="fa-blue">薔琵</span><br>編號第 29 號<br>國際命名 CHAMPI'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">現況</span>'+
                    '<p>2026年10月23日08時</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>中心位置在北緯 22.6 度，東經 123.9 度</li>'+
                        '<li>過去移動方向 北北西</li>'+
                        '<li>過去移動時速 24公里</li>'+
                        '<li>中心氣壓 945百帕</li>'+
                        '<li>近中心最大風速每秒 43 公尺</li>'+
                        '<li>瞬間最大陣風每秒 53 公尺</li>'+
                        '<li>七級風平均暴風半徑 320 公里<br>　西北側 330 公里 東北側 350 公里<br>　西南側 270 公里 東南側 310 公里</li>'+
                        '<li>十級風平均暴風半徑 120 公里<br>　西北側 120 公里 東北側 120 公里<br>　西南側 120 公里 東南側 120 公里</li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">預測</span>'+
                    '<p>預測 6 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 19 公里</li>'+
                        '<li>預測 10月23日14時</li>'+
                        '<li>中心位置在北緯 23.4 度，東經 123.4 度</li>'+
                        '<li>中心氣壓945百帕</li>'+
                        '<li>近中心最大風速每秒 43 公尺</li>'+
                        '<li>瞬間最大陣風每秒 53 公尺</li>'+
                        '<li>七級風暴風半徑 320 公里</li>'+
                        '<li>十級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 30 公里</li>'+
                    '</ul>'+
                    '<p>預測 6-12 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>西北 時速 16 公里</li>'+
                        '<li>預測 10月23日20時</li>'+
                        '<li>中心位置在北緯 24.1 度，東經 122.8 度</li>'+
                        '<li>中心氣壓945百帕</li>'+
                        '<li>近中心最大風速每秒 43 公尺</li>'+
                        '<li>瞬間最大陣風每秒 53 公尺</li>'+
                        '<li>七級風暴風半徑 320 公里</li>'+
                        '<li>十級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 40 公里</li>'+
                    '</ul>'+
                    '<p>預測 12-18 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 11 公里</li>'+
                        '<li>預測 10月24日02時</li>'+
                        '<li>中心位置在北緯 24.6 度，東經 122.5 度</li>'+
                        '<li>中心氣壓960百帕</li>'+
                        '<li>近中心最大風速每秒 38 公尺</li>'+
                        '<li>瞬間最大陣風每秒 48 公尺</li>'+
                        '<li>七級風暴風半徑 320 公里</li>'+
                        '<li>十級風暴風半徑 100 公里</li>'+
                        '<li>70%機率半徑 80 公里</li>'+
                    '</ul>'+
                    '<p>預測 18-24 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 時速 11 公里</li>'+
                        '<li>預測 10月24日08時</li>'+
                        '<li>中心位置在北緯 25.2 度，東經 122.6 度</li>'+
                        '<li>中心氣壓970百帕</li>'+
                        '<li>近中心最大風速每秒 33 公尺</li>'+
                        '<li>瞬間最大陣風每秒 43 公尺</li>'+
                        '<li>七級風暴風半徑 280 公里</li>'+
                        '<li>十級風暴風半徑 90 公里</li>'+
                        '<li>70%機率半徑 90 公里</li>'+
                    '</ul>'+
                    '<p>預測 24-36 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 時速 14 公里</li>'+
                        '<li>預測 10月24日20時</li>'+
                        '<li>中心位置在北緯 26.7 度，東經 122.9 度</li>'+
                        '<li>中心氣壓980百帕</li>'+
                        '<li>近中心最大風速每秒 28 公尺</li>'+
                        '<li>瞬間最大陣風每秒 35 公尺</li>'+
                        '<li>七級風暴風半徑 250 公里</li>'+
                        '<li>70%機率半徑 100 公里</li>'+
                    '</ul>'+
                    '<p>預測 36-48 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北東 時速 22 公里</li>'+
                        '<li>預測 10月25日08時</li>'+
                        '<li>中心位置在北緯 28.9 度，東經 124.0 度</li>'+
                        '<li>中心氣壓988百帕</li>'+
                        '<li>近中心最大風速每秒 23 公尺</li>'+
                        '<li>瞬間最大陣風每秒 30 公尺</li>'+
                        '<li>七級風暴風半徑 180 公里</li>'+
                        '<li>70%機率半徑 150 公里</li>'+
                    '</ul>'+
                    '<p>預測 48-72 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東北 時速 19 公里</li>'+
                        '<li>預測 10月26日08時</li>'+
                        '<li>中心位置在北緯 31.5 度，東經 127.6 度</li>'+
                        '<li>中心氣壓998百帕</li>'+
                        '<li>近中心最大風速每秒 18 公尺</li>'+
                        '<li>瞬間最大陣風每秒 25 公尺</li>'+
                        '<li>七級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 210 公里</li>'+
                    '</ul>'+
                    '<p class="Move-120h">預測 72-96 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>東北東 時速 21 公里</li>'+
                        '<li>預測 10月27日08時</li>'+
                        '<li>中心位置在北緯 32.8 度，東經 132.8 度</li>'+
                        '<li>中心氣壓998百帕</li>'+
                        '<li></li>'+
                        '<li></li>'+
                        '<li>70%機率半徑 360 公里</li>'+
                        '<li>預測 96 小時內變性為溫帶氣旋</li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B2" title="點此展開" aria-expanded="false">'+
                    '<span class="fa-red">熱帶性低氣壓</span><span class="fa-blue">TD34</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">現況</span>'+
                    '<p>2026年10月23日08時</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>中心位置在北緯 11.0 度，東經 166.5 度</li>'+
                        '<li>過去移動方向 -</li>'+
                        '<li>過去移動時速 -公里</li>'+
                        '<li>中心氣壓 1004百帕</li>'+
                        '<li>近中心最大風速每秒 15 公尺</li>'+
                        '<li>瞬間最大陣風每秒 23 公尺</li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">預測</span>'+
                    '<p>預測 6 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>西南 緩慢移動</li>'+
                        '<li>預測 10月23日14時</li>'+
                        '<li>中心位置在北緯 10.8 度，東經 166.3 度</li>'+
                        '<li>中心氣壓1004百帕</li>'+
                        '<li>近中心最大風速每秒 15 公尺</li>'+
                        '<li>瞬間最大陣風每秒 23 公尺</li>'+
                        '<li>70%機率半徑 50 公里</li>'+
                    '</ul>'+
                    '<p>預測 6-12 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東南 時速 8 公里</li>'+
                        '<li>預測 10月23日20時</li>'+
                        '<li>中心位置在北緯 10.5 度，東經 166.6 度</li>'+
                        '<li>中心氣壓1004百帕</li>'+
                        '<li>近中心最大風速每秒 15 公尺</li>'+
                        '<li>瞬間最大陣風每秒 23 公尺</li>'+
                        '<li>70%機率半徑 100 公里</li>'+
                    '</ul>'+
                    '<p>預測 12-18 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東 緩慢移動</li>'+
                        '<li>預測 10月24日02時</li>'+
                        '<li>中心位置在北緯 10.5 度，東經 166.9 度</li>'+
                        '<li>中心氣壓1004百帕</li>'+
                        '<li>近中心最大風速每秒 15 公尺</li>'+
                        '<li>瞬間最大陣風每秒 23 公尺</li>'+
                        '<li>70%機率半徑 120 公里</li>'+
                    '</ul>'+
                    '<p>預測 18-24 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 近似滯留</li>'+
                        '<li>預測 10月24日08時</li>'+
                        '<li>中心位置在北緯 10.6 度，東經 166.9 度</li>'+
                        '<li>中心氣壓1002百帕</li>'+
                        '<li>近中心最大風速每秒 18 公尺</li>'+
                        '<li>瞬間最大陣風每秒 25 公尺</li>'+
                        '<li>七級風暴風半徑 80 公里</li>'+
                        '<li>70%機率半徑 140 公里</li>'+
                        '<li>預測 24 小時內有發展為輕度颱風的趨勢</li>'+
                    '</ul>'+
                    '<p>預測 24-36 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 緩慢移動</li>'+
                        '<li>預測 10月24日20時</li>'+
                        '<li>中心位置在北緯 11.1 度，東經 167.0 度</li>'+
                        '<li>中心氣壓998百帕</li>'+
                        '<li>近中心最大風速每秒 20 公尺</li>'+
                        '<li>瞬間最大陣風每秒 28 公尺</li>'+
                        '<li>七級風暴風半徑 100 公里</li>'+
                        '<li>70%機率半徑 150 公里</li>'+
                    '</ul>'+
                    '<p>預測 36-48 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 時速 11 公里</li>'+
                        '<li>預測 10月25日08時</li>'+
                        '<li>中心位置在北緯 12.3 度，東經 167.0 度</li>'+
                        '<li>中心氣壓992百帕</li>'+
                        '<li>近中心最大風速每秒 25 公尺</li>'+
                        '<li>瞬間最大陣風每秒 33 公尺</li>'+
                        '<li>七級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 180 公里</li>'+
                    '</ul>'+
                    '<p>預測 48-72 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 時速 12 公里</li>'+
                        '<li>預測 10月26日08時</li>'+
                        '<li>中心位置在北緯 15.0 度，東經 166.8 度</li>'+
                        '<li>中心氣壓975百帕</li>'+
                        '<li>近中心最大風速每秒 38 公尺</li>'+
                        '<li>瞬間最大陣風每秒 48 公尺</li>'+
                        '<li>七級風暴風半徑 150 公里</li>'+
                        '<li>十級風暴風半徑 50 公里</li>'+
                        '<li>70%機率半徑 330 公里</li>'+
                    '</ul>'+
                    '<p class="Move-120h">預測 72-96 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>東北東 時速 8 公里</li>'+
                        '<li>預測 10月27日08時</li>'+
                        '<li>中心位置在北緯 15.7 度，東經 168.5 度</li>'+
                        '<li>中心氣壓970百帕</li>'+
                        '<li>近中心最大風速每秒 43 公尺</li>'+
                        '<li>瞬間最大陣風每秒 55 公尺</li>'+
                        '<li>七級風暴風半徑 180 公里</li>'+
                        '<li>十級風暴風半徑 60 公里</li>'+
                        '<li>70%機率半徑 350 公里</li>'+
                    '</ul>'+
                    '<p class="Move-120h">預測 96-120 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>東北東 近似滯留</li>'+
                        '<li>預測 10月28日08時</li>'+
                        '<li>中心位置在北緯 15.8 度，東經 168.8 度</li>'+
                        '<li>中心氣壓965百帕</li>'+
                        '<li>近中心最大風速每秒 45 公尺</li>'+
                        '<li>瞬間最大陣風每秒 55 公尺</li>'+
                        '<li>七級風暴風半徑 200 公里</li>'+
                        '<li>十級風暴風半徑 70 公里</li>'+
                        '<li>70%機率半徑 540 公里</li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</div>'+
    '</div>';
TY_LIST_1['E'] = ''+
    '<div class="panel panel-default" id="CHAMPI">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A1" title="Check more details" aria-expanded="true">'+
                    '<span class="fa-red">TYPHOON</span><br><span class="fa-blue">CHAMPI (202629)</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<p>Position 230000Z at 22.6N 123.9E, Movement: NNW 19km/h. <span class="fa-blue">Minimum pressure 945 hPa, Max sustained winds near center 43 meter per second</span>, Gusts 53 meter per second, Average radius of over 15m/s winds 320km(330km NW quad. , 350km NE quad. , 270km SW quad. , 310km SE quad. ), Average radius of over 25m/s winds 120km(120km NW quad. , 120km NE quad. , 120km SW quad. , 120km SE quad. ).</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default" id="TD34">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A2" title="Check more details" aria-expanded="false">'+
                    '<span class="fa-red">TROPICAL DEPRESSION</span><br><span class="fa-blue">TD34</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<p>Position 230000Z at 11.0N 166.5E, Movement: SW 5km/h. <span class="fa-blue">Minimum pressure 1004 hPa, Max sustained winds near center 15 meter per second</span>, Gusts 23 meter per second.</p>'+
            '</div>'+
        '</div>'+
    '</div>';
TY_LIST_2['E'] = ''+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B1" title="Check more details" aria-expanded="true">'+
                    '<span class="fa-red">TYPHOON</span><br><span class="fa-blue">CHAMPI (202629)</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">Analysis</span>'+
                    '<p>0000UTC 23 October 2026</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>Center Location 22.6N 123.9E</li>'+
                        '<li>Movement NNW 24km/h</li>'+
                        '<li>Minimum Pressure 945 hPa</li>'+
                        '<li>Maximum Wind Speed 43 m/s</li>'+
                        '<li>Gust 53 m/s</li>'+
                        '<li>Average radius of over 15m/s winds 320km<br>　330km NW quad.  350km NE quad. <br>　270km SW quad.  310km SE quad. </li>'+
                        '<li>Average radius of over 25m/s winds 120km<br>　120km NW quad.  120km NE quad. <br>　120km SW quad.  120km SE quad. </li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">Forecast</span>'+
                    '<p>6 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 23 October 2026</li>'+
                        '<li>Center Position 23.4N 123.4E</li>'+
                        '<li>Vector to 6 HR Position</li>'+
                        '<li>NNW 19 km/h</li>'+
                        '<li>Minimum Pressure 945 hPa</li>'+
                        '<li>Maximum Wind Speed 43 m/s</li>'+
                        '<li>Gust 53 m/s</li>'+
                        '<li>Radius of over 15m/s winds 320km</li>'+
                        '<li>Radius of over 25m/s winds 120km</li>'+
                        '<li>Radius of 70% probability circle 30km</li>'+
                    '</ul>'+
                    '<p>12 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1200UTC 23 October 2026</li>'+
                        '<li>Center Position 24.1N 122.8E</li>'+
                        '<li>Vector to 12 HR Position</li>'+
                        '<li>NW 16 km/h</li>'+
                        '<li>Minimum Pressure 945 hPa</li>'+
                        '<li>Maximum Wind Speed 43 m/s</li>'+
                        '<li>Gust 53 m/s</li>'+
                        '<li>Radius of over 15m/s winds 320km</li>'+
                        '<li>Radius of over 25m/s winds 120km</li>'+
                        '<li>Radius of 70% probability circle 40km</li>'+
                    '</ul>'+
                    '<p>18 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1800UTC 23 October 2026</li>'+
                        '<li>Center Position 24.6N 122.5E</li>'+
                        '<li>Vector to 18 HR Position</li>'+
                        '<li>NNW 11 km/h</li>'+
                        '<li>Minimum Pressure 960 hPa</li>'+
                        '<li>Maximum Wind Speed 38 m/s</li>'+
                        '<li>Gust 48 m/s</li>'+
                        '<li>Radius of over 15m/s winds 320km</li>'+
                        '<li>Radius of over 25m/s winds 100km</li>'+
                        '<li>Radius of 70% probability circle 80km</li>'+
                    '</ul>'+
                    '<p>24 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 24 October 2026</li>'+
                        '<li>Center Position 25.2N 122.6E</li>'+
                        '<li>Vector to 24 HR Position</li>'+
                        '<li>N 11 km/h</li>'+
                        '<li>Minimum Pressure 970 hPa</li>'+
                        '<li>Maximum Wind Speed 33 m/s</li>'+
                        '<li>Gust 43 m/s</li>'+
                        '<li>Radius of over 15m/s winds 280km</li>'+
                        '<li>Radius of over 25m/s winds 90km</li>'+
                        '<li>Radius of 70% probability circle 90km</li>'+
                    '</ul>'+
                    '<p>36 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1200UTC 24 October 2026</li>'+
                        '<li>Center Position 26.7N 122.9E</li>'+
                        '<li>Vector to 36 HR Position</li>'+
                        '<li>N 14 km/h</li>'+
                        '<li>Minimum Pressure 980 hPa</li>'+
                        '<li>Maximum Wind Speed 28 m/s</li>'+
                        '<li>Gust 35 m/s</li>'+
                        '<li>Radius of over 15m/s winds 250km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 100km</li>'+
                    '</ul>'+
                    '<p>48 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 25 October 2026</li>'+
                        '<li>Center Position 28.9N 124.0E</li>'+
                        '<li>Vector to 48 HR Position</li>'+
                        '<li>NNE 22 km/h</li>'+
                        '<li>Minimum Pressure 988 hPa</li>'+
                        '<li>Maximum Wind Speed 23 m/s</li>'+
                        '<li>Gust 30 m/s</li>'+
                        '<li>Radius of over 15m/s winds 180km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 150km</li>'+
                    '</ul>'+
                    '<p>72 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 26 October 2026</li>'+
                        '<li>Center Position 31.5N 127.6E</li>'+
                        '<li>Vector to 72 HR Position</li>'+
                        '<li>NE 19 km/h</li>'+
                        '<li>Minimum Pressure 998 hPa</li>'+
                        '<li>Maximum Wind Speed 18 m/s</li>'+
                        '<li>Gust 25 m/s</li>'+
                        '<li>Radius of over 15m/s winds 120km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 210km</li>'+
                    '</ul>'+
                    '<p class="Move-120h">96 hours valid at:</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>0000UTC 27 October 2026</li>'+
                        '<li>Center Position 32.8N 132.8E</li>'+
                        '<li>Vector to 96 HR Position</li>'+
                        '<li>ENE 21 km/h</li>'+
                        '<li>Minimum Pressure 998 hPa</li>'+
                        '<li>Maximum Wind Speed  m/s</li>'+
                        '<li>Gust  m/s</li>'+
                        '<li>Radius of 70% probability circle 360km</li>'+
                        '<li>Becoming extratropical low at 96 hours</li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B2" title="Check more details" aria-expanded="false">'+
                    '<span class="fa-red">TROPICAL DEPRESSION</span><br><span class="fa-blue">TD34</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">Analysis</span>'+
                    '<p>0000UTC 23 October 2026</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>Center Location 11.0N 166.5E</li>'+
                        '<li>Movement - -km/h</li>'+
                        '<li>Minimum Pressure 1004 hPa</li>'+
                        '<li>Maximum Wind Speed 15 m/s</li>'+
                        '<li>Gust 23 m/s</li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">Forecast</span>'+
                    '<p>6 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 23 October 2026</li>'+
                        '<li>Center Position 10.8N 166.3E</li>'+
                        '<li>Vector to 6 HR Position</li>'+
                        '<li>SW Slowly</li>'+
                        '<li>Minimum Pressure 1004 hPa</li>'+
                        '<li>Maximum Wind Speed 15 m/s</li>'+
                        '<li>Gust 23 m/s</li>'+
                        '<li>Radius of 70% probability circle 50km</li>'+
                    '</ul>'+
                    '<p>12 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1200UTC 23 October 2026</li>'+
                        '<li>Center Position 10.5N 166.6E</li>'+
                        '<li>Vector to 12 HR Position</li>'+
                        '<li>SE 8 km/h</li>'+
                        '<li>Minimum Pressure 1004 hPa</li>'+
                        '<li>Maximum Wind Speed 15 m/s</li>'+
                        '<li>Gust 23 m/s</li>'+
                        '<li>Radius of 70% probability circle 100km</li>'+
                    '</ul>'+
                    '<p>18 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1800UTC 23 October 2026</li>'+
                        '<li>Center Position 10.5N 166.9E</li>'+
                        '<li>Vector to 18 HR Position</li>'+
                        '<li>E Slowly</li>'+
                        '<li>Minimum Pressure 1004 hPa</li>'+
                        '<li>Maximum Wind Speed 15 m/s</li>'+
                        '<li>Gust 23 m/s</li>'+
                        '<li>Radius of 70% probability circle 120km</li>'+
                    '</ul>'+
                    '<p>24 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 24 October 2026</li>'+
                        '<li>Center Position 10.6N 166.9E</li>'+
                        '<li>Vector to 24 HR Position</li>'+
                        '<li>N Almost Stationary</li>'+
                        '<li>Minimum Pressure 1002 hPa</li>'+
                        '<li>Maximum Wind Speed 18 m/s</li>'+
                        '<li>Gust 25 m/s</li>'+
                        '<li>Radius of over 15m/s winds 80km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 140km</li>'+
                        '<li>Becoming tropical storm at 24 hours</li>'+
                    '</ul>'+
                    '<p>36 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1200UTC 24 October 2026</li>'+
                        '<li>Center Position 11.1N 167.0E</li>'+
                        '<li>Vector to 36 HR Position</li>'+
                        '<li>N Slowly</li>'+
                        '<li>Minimum Pressure 998 hPa</li>'+
                        '<li>Maximum Wind Speed 20 m/s</li>'+
                        '<li>Gust 28 m/s</li>'+
                        '<li>Radius of over 15m/s winds 100km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 150km</li>'+
                    '</ul>'+
                    '<p>48 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 25 October 2026</li>'+
                        '<li>Center Position 12.3N 167.0E</li>'+
                        '<li>Vector to 48 HR Position</li>'+
                        '<li>N 11 km/h</li>'+
                        '<li>Minimum Pressure 992 hPa</li>'+
                        '<li>Maximum Wind Speed 25 m/s</li>'+
                        '<li>Gust 33 m/s</li>'+
                        '<li>Radius of over 15m/s winds 120km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 180km</li>'+
                    '</ul>'+
                    '<p>72 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 26 October 2026</li>'+
                        '<li>Center Position 15.0N 166.8E</li>'+
                        '<li>Vector to 72 HR Position</li>'+
                        '<li>N 12 km/h</li>'+
                        '<li>Minimum Pressure 975 hPa</li>'+
                        '<li>Maximum Wind Speed 38 m/s</li>'+
                        '<li>Gust 48 m/s</li>'+
                        '<li>Radius of over 15m/s winds 150km</li>'+
                        '<li>Radius of over 25m/s winds 50km</li>'+
                        '<li>Radius of 70% probability circle 330km</li>'+
                    '</ul>'+
                    '<p class="Move-120h">96 hours valid at:</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>0000UTC 27 October 2026</li>'+
                        '<li>Center Position 15.7N 168.5E</li>'+
                        '<li>Vector to 96 HR Position</li>'+
                        '<li>ENE 8 km/h</li>'+
                        '<li>Minimum Pressure 970 hPa</li>'+
                        '<li>Maximum Wind Speed 43 m/s</li>'+
                        '<li>Gust 55 m/s</li>'+
                        '<li>Radius of over 15m/s winds 180km</li>'+
                        '<li>Radius of over 25m/s winds 60km</li>'+
                        '<li>Radius of 70% probability circle 350km</li>'+
                    '</ul>'+
                    '<p class="Move-120h">120 hours valid at:</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>0000UTC 28 October 2026</li>'+
                        '<li>Center Position 15.8N 168.8E</li>'+
                        '<li>Vector to 120 HR Position</li>'+
                        '<li>ENE Almost Stationary</li>'+
                        '<li>Minimum Pressure 965 hPa</li>'+
                        '<li>Maximum Wind Speed 45 m/s</li>'+
                        '<li>Gust 55 m/s</li>'+
                        '<li>Radius of over 15m/s winds 200km</li>'+
                        '<li>Radius of over 25m/s winds 70km</li>'+
                        '<li>Radius of 70% probability circle 540km</li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</div>'+
    '</div>';

var W23_Name = 'CHAMPI';
var W23_Body = ''+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A1" title="點此展開" aria-expanded="true">預測 6 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<p>北北西 時速 19 公里'+
                    '<br /> 預測 10月23日14時'+
                    '<br /> 中心位置在北緯 23.4 度，東經 123.4 度'+
                    '<br /> 中心氣壓945百帕'+
                    '<br /> 近中心最大風速每秒 43 公尺'+
                    '<br /> 瞬間最大陣風每秒 53 公尺'+
                    '<br /> 七級風暴風半徑 320 公里'+
                    '<br /> 十級風暴風半徑 120 公里'+
                    '<br /> 70%機率半徑 30 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A2" title="點此展開" aria-expanded=" false">預測 6-12 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A2" class="panel-collapse collapse" aria-expanded=" false" role="document">'+
            '<div class="panel-body">'+
                '<p>西北 時速 16 公里'+
                    '<br /> 預測 10月23日20時'+
                    '<br /> 中心位置在北緯 24.1 度，東經 122.8 度'+
                    '<br /> 中心氣壓945百帕'+
                    '<br /> 近中心最大風速每秒 43 公尺'+
                    '<br /> 瞬間最大陣風每秒 53 公尺'+
                    '<br /> 七級風暴風半徑 320 公里'+
                    '<br /> 十級風暴風半徑 120 公里'+
                    '<br /> 70%機率半徑 40 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A3" title="點此展開" aria-expanded=" false">預測 12-18 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A3" class="panel-collapse collapse" aria-expanded=" false" role="document">'+
            '<div class="panel-body">'+
                '<p>北北西 時速 11 公里'+
                    '<br /> 預測 10月24日02時'+
                    '<br /> 中心位置在北緯 24.6 度，東經 122.5 度'+
                    '<br /> 中心氣壓960百帕'+
                    '<br /> 近中心最大風速每秒 38 公尺'+
                    '<br /> 瞬間最大陣風每秒 48 公尺'+
                    '<br /> 七級風暴風半徑 320 公里'+
                    '<br /> 十級風暴風半徑 100 公里'+
                    '<br /> 70%機率半徑 80 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A4" title="點此展開" aria-expanded=" false">預測 18-24 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A4" class="panel-collapse collapse" aria-expanded=" false" role="document">'+
            '<div class="panel-body">'+
                '<p>北 時速 11 公里'+
                    '<br /> 預測 10月24日08時'+
                    '<br /> 中心位置在北緯 25.2 度，東經 122.6 度'+
                    '<br /> 中心氣壓970百帕'+
                    '<br /> 近中心最大風速每秒 33 公尺'+
                    '<br /> 瞬間最大陣風每秒 43 公尺'+
                    '<br /> 七級風暴風半徑 280 公里'+
                    '<br /> 十級風暴風半徑 90 公里'+
                    '<br /> 70%機率半徑 90 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A5" title="點此展開" aria-expanded=" false">預測 24-36 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A5" class="panel-collapse collapse" aria-expanded=" false" role="document">'+
            '<div class="panel-body">'+
                '<p>北 時速 14 公里'+
                    '<br /> 預測 10月24日20時'+
                    '<br /> 中心位置在北緯 26.7 度，東經 122.9 度'+
                    '<br /> 中心氣壓980百帕'+
                    '<br /> 近中心最大風速每秒 28 公尺'+
                    '<br /> 瞬間最大陣風每秒 35 公尺'+
                    '<br /> 七級風暴風半徑 250 公里'+
                    '<br /> 70%機率半徑 100 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A6" title="點此展開" aria-expanded=" false">預測 36-48 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A6" class="panel-collapse collapse" aria-expanded=" false" role="document">'+
            '<div class="panel-body">'+
                '<p>北北東 時速 22 公里'+
                    '<br /> 預測 10月25日08時'+
                    '<br /> 中心位置在北緯 28.9 度，東經 124.0 度'+
                    '<br /> 中心氣壓988百帕'+
                    '<br /> 近中心最大風速每秒 23 公尺'+
                    '<br /> 瞬間最大陣風每秒 30 公尺'+
                    '<br /> 七級風暴風半徑 180 公里'+
                    '<br /> 70%機率半徑 150 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A7" title="點此展開" aria-expanded=" false">預測 48-72 小時平均移向移速為</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A7" class="panel-collapse collapse" aria-expanded=" false" role="document">'+
            '<div class="panel-body">'+
                '<p>東北 時速 19 公里'+
                    '<br /> 預測 10月26日08時'+
                    '<br /> 中心位置在北緯 31.5 度，東經 127.6 度'+
                    '<br /> 中心氣壓998百帕'+
                    '<br /> 近中心最大風速每秒 18 公尺'+
                    '<br /> 瞬間最大陣風每秒 25 公尺'+
                    '<br /> 七級風暴風半徑 120 公里'+
                    '<br /> 70%機率半徑 210 公里'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>';
