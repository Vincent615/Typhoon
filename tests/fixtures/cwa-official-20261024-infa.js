// [RJ] for TY_NEWS.html, W23.html
// Update: 2026-10-24 14:59:25
var DataPath = 'typhoon/TY_NEWS/';
var TY_DataTime = '202610240600';
var TY_COUNT = [0,2];
var TY_TIME = {'C':'民國115年10月24日14時','E':'2026/10/24 06:00 UTC'};
var TYPHOON = {
	'CHAMPI':{'Name':{'C':'薔琵','E':'CHAMPI'}},
	'IN-FA':{'Name':{'C':'煙花','E':'IN-FA'}}
};
var TY_LIST_1 = new Array();
var TY_LIST_2 = new Array();
TY_LIST_1['C'] = ''+
    '<div class="panel panel-default" id="CHAMPI">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A1" title="點此展開" aria-expanded="true">'+
                    '<span class="fa-red">輕度颱風</span><span class="fa-blue">薔琵</span><br>編號第 29 號<br>國際命名 CHAMPI'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<p>24日14時的中心位置在北緯 26.8 度，東經 123.2 度，以每小時19公里速度，向北進行。<span class="fa-blue">中心氣壓</span><span class="fa-red">975</span><span class="fa-blue">百帕</span>，<span class="fa-blue">近中心最大風速每秒</span><span class="fa-red">30</span><span class="fa-blue">公尺</span>，瞬間最大陣風每秒 38 公尺，七級風平均暴風半徑 200 公里(西北側 160 公里、東北側 240 公里、西南側 140 公里、東南側 240 公里)，十級風平均暴風半徑 70 公里(西北側 50 公里、東北側 80 公里、西南側 50 公里、東南側 80 公里)。</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default" id="IN-FA">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A2" title="點此展開" aria-expanded="false">'+
                    '<span class="fa-red">輕度颱風</span><span class="fa-blue">煙花</span><br>編號第 30 號<br>國際命名 IN-FA'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<p>24日14時的中心位置在北緯 10.1 度，東經 166.0 度，以每小時6公里速度，向北北西進行。<span class="fa-blue">中心氣壓</span><span class="fa-red">995</span><span class="fa-blue">百帕</span>，<span class="fa-blue">近中心最大風速每秒</span><span class="fa-red">20</span><span class="fa-blue">公尺</span>，瞬間最大陣風每秒 28 公尺，七級風平均暴風半徑 80 公里(西北側 100 公里、東北側 80 公里、西南側 80 公里、東南側 60 公里)，十級風平均暴風半徑 - 公里。</p>'+
            '</div>'+
        '</div>'+
    '</div>';
TY_LIST_2['C'] = ''+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B1" title="點此展開" aria-expanded="true">'+
                    '<span class="fa-red">輕度颱風</span><span class="fa-blue">薔琵</span><br>編號第 29 號<br>國際命名 CHAMPI'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">現況</span>'+
                    '<p>2026年10月24日14時</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>中心位置在北緯 26.8 度，東經 123.2 度</li>'+
                        '<li>過去移動方向 北</li>'+
                        '<li>過去移動時速 33公里</li>'+
                        '<li>中心氣壓 975百帕</li>'+
                        '<li>近中心最大風速每秒 30 公尺</li>'+
                        '<li>瞬間最大陣風每秒 38 公尺</li>'+
                        '<li>七級風平均暴風半徑 200 公里<br>　西北側 160 公里 東北側 240 公里<br>　西南側 140 公里 東南側 240 公里</li>'+
                        '<li>十級風平均暴風半徑 70 公里<br>　西北側 50 公里 東北側 80 公里<br>　西南側 50 公里 東南側 80 公里</li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">預測</span>'+
                    '<p>預測 6 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 時速 19 公里</li>'+
                        '<li>預測 10月24日20時</li>'+
                        '<li>中心位置在北緯 27.7 度，東經 123.3 度</li>'+
                        '<li>中心氣壓980百帕</li>'+
                        '<li>近中心最大風速每秒 28 公尺</li>'+
                        '<li>瞬間最大陣風每秒 35 公尺</li>'+
                        '<li>七級風暴風半徑 180 公里</li>'+
                        '<li>70%機率半徑 30 公里</li>'+
                    '</ul>'+
                    '<p>預測 6-12 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北東 時速 18 公里</li>'+
                        '<li>預測 10月25日02時</li>'+
                        '<li>中心位置在北緯 28.6 度，東經 123.7 度</li>'+
                        '<li>中心氣壓985百帕</li>'+
                        '<li>近中心最大風速每秒 25 公尺</li>'+
                        '<li>瞬間最大陣風每秒 33 公尺</li>'+
                        '<li>七級風暴風半徑 180 公里</li>'+
                        '<li>70%機率半徑 40 公里</li>'+
                    '</ul>'+
                    '<p>預測 12-18 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東北 時速 19 公里</li>'+
                        '<li>預測 10月25日08時</li>'+
                        '<li>中心位置在北緯 29.4 度，東經 124.4 度</li>'+
                        '<li>中心氣壓988百帕</li>'+
                        '<li>近中心最大風速每秒 23 公尺</li>'+
                        '<li>瞬間最大陣風每秒 30 公尺</li>'+
                        '<li>七級風暴風半徑 150 公里</li>'+
                        '<li>70%機率半徑 80 公里</li>'+
                    '</ul>'+
                    '<p>預測 18-24 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東北 時速 21 公里</li>'+
                        '<li>預測 10月25日14時</li>'+
                        '<li>中心位置在北緯 30.2 度，東經 125.3 度</li>'+
                        '<li>中心氣壓995百帕</li>'+
                        '<li>近中心最大風速每秒 20 公尺</li>'+
                        '<li>瞬間最大陣風每秒 28 公尺</li>'+
                        '<li>七級風暴風半徑 150 公里</li>'+
                        '<li>70%機率半徑 90 公里</li>'+
                    '</ul>'+
                    '<p>預測 24-36 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東北 時速 22 公里</li>'+
                        '<li>預測 10月26日02時</li>'+
                        '<li>中心位置在北緯 31.6 度，東經 127.6 度</li>'+
                        '<li>中心氣壓998百帕</li>'+
                        '<li>近中心最大風速每秒 18 公尺</li>'+
                        '<li>瞬間最大陣風每秒 25 公尺</li>'+
                        '<li>七級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 110 公里</li>'+
                    '</ul>'+
                    '<p>預測 36-48 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>東北東 時速 36 公里</li>'+
                        '<li>預測 10月26日14時</li>'+
                        '<li>中心位置在北緯 32.9 度，東經 131.9 度</li>'+
                        '<li>中心氣壓1005百帕</li>'+
                        '<li></li>'+
                        '<li></li>'+
                        '<li>70%機率半徑 130 公里</li>'+
                        '<li>預測 48 小時內變性為溫帶氣旋</li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B2" title="點此展開" aria-expanded="false">'+
                    '<span class="fa-red">輕度颱風</span><span class="fa-blue">煙花</span><br>編號第 30 號<br>國際命名 IN-FA'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">現況</span>'+
                    '<p>2026年10月24日14時</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>中心位置在北緯 10.1 度，東經 166.0 度</li>'+
                        '<li>過去移動方向 西</li>'+
                        '<li>過去移動時速 4公里</li>'+
                        '<li>中心氣壓 995百帕</li>'+
                        '<li>近中心最大風速每秒 20 公尺</li>'+
                        '<li>瞬間最大陣風每秒 28 公尺</li>'+
                        '<li>七級風平均暴風半徑 80 公里<br>　西北側 100 公里 東北側 80 公里<br>　西南側 80 公里 東南側 60 公里</li>'+
                        '<li>十級風平均暴風半徑 - 公里</li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">預測</span>'+
                    '<p>預測 6 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 6 公里</li>'+
                        '<li>預測 10月24日20時</li>'+
                        '<li>中心位置在北緯 10.4 度，東經 165.9 度</li>'+
                        '<li>中心氣壓988百帕</li>'+
                        '<li>近中心最大風速每秒 23 公尺</li>'+
                        '<li>瞬間最大陣風每秒 30 公尺</li>'+
                        '<li>七級風暴風半徑 100 公里</li>'+
                        '<li>70%機率半徑 30 公里</li>'+
                    '</ul>'+
                    '<p>預測 6-12 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 9 公里</li>'+
                        '<li>預測 10月25日02時</li>'+
                        '<li>中心位置在北緯 10.9 度，東經 165.8 度</li>'+
                        '<li>中心氣壓985百帕</li>'+
                        '<li>近中心最大風速每秒 25 公尺</li>'+
                        '<li>瞬間最大陣風每秒 33 公尺</li>'+
                        '<li>七級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 40 公里</li>'+
                    '</ul>'+
                    '<p>預測 12-18 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 12 公里</li>'+
                        '<li>預測 10月25日08時</li>'+
                        '<li>中心位置在北緯 11.5 度，東經 165.5 度</li>'+
                        '<li>中心氣壓980百帕</li>'+
                        '<li>近中心最大風速每秒 28 公尺</li>'+
                        '<li>瞬間最大陣風每秒 35 公尺</li>'+
                        '<li>七級風暴風半徑 120 公里</li>'+
                        '<li>70%機率半徑 80 公里</li>'+
                    '</ul>'+
                    '<p>預測 18-24 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 15 公里</li>'+
                        '<li>預測 10月25日14時</li>'+
                        '<li>中心位置在北緯 12.2 度，東經 165.1 度</li>'+
                        '<li>中心氣壓970百帕</li>'+
                        '<li>近中心最大風速每秒 33 公尺</li>'+
                        '<li>瞬間最大陣風每秒 43 公尺</li>'+
                        '<li>七級風暴風半徑 150 公里</li>'+
                        '<li>十級風暴風半徑 50 公里</li>'+
                        '<li>70%機率半徑 90 公里</li>'+
                    '</ul>'+
                    '<p>預測 24-36 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>西北 時速 12 公里</li>'+
                        '<li>預測 10月26日02時</li>'+
                        '<li>中心位置在北緯 13.2 度，東經 164.2 度</li>'+
                        '<li>中心氣壓960百帕</li>'+
                        '<li>近中心最大風速每秒 38 公尺</li>'+
                        '<li>瞬間最大陣風每秒 48 公尺</li>'+
                        '<li>七級風暴風半徑 180 公里</li>'+
                        '<li>十級風暴風半徑 60 公里</li>'+
                        '<li>70%機率半徑 100 公里</li>'+
                    '</ul>'+
                    '<p>預測 36-48 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北北西 時速 8 公里</li>'+
                        '<li>預測 10月26日14時</li>'+
                        '<li>中心位置在北緯 14.0 度，東經 163.9 度</li>'+
                        '<li>中心氣壓950百帕</li>'+
                        '<li>近中心最大風速每秒 40 公尺</li>'+
                        '<li>瞬間最大陣風每秒 50 公尺</li>'+
                        '<li>七級風暴風半徑 200 公里</li>'+
                        '<li>十級風暴風半徑 70 公里</li>'+
                        '<li>70%機率半徑 130 公里</li>'+
                    '</ul>'+
                    '<p>預測 48-72 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>北 緩慢移動</li>'+
                        '<li>預測 10月27日14時</li>'+
                        '<li>中心位置在北緯 14.6 度，東經 163.8 度</li>'+
                        '<li>中心氣壓930百帕</li>'+
                        '<li>近中心最大風速每秒 48 公尺</li>'+
                        '<li>瞬間最大陣風每秒 58 公尺</li>'+
                        '<li>七級風暴風半徑 200 公里</li>'+
                        '<li>十級風暴風半徑 70 公里</li>'+
                        '<li>70%機率半徑 200 公里</li>'+
                    '</ul>'+
                    '<p class="Move-120h">預測 72-96 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>西 時速 13 公里</li>'+
                        '<li>預測 10月28日14時</li>'+
                        '<li>中心位置在北緯 15.0 度，東經 161.0 度</li>'+
                        '<li>中心氣壓925百帕</li>'+
                        '<li>近中心最大風速每秒 51 公尺</li>'+
                        '<li>瞬間最大陣風每秒 63 公尺</li>'+
                        '<li>七級風暴風半徑 200 公里</li>'+
                        '<li>十級風暴風半徑 70 公里</li>'+
                        '<li>70%機率半徑 360 公里</li>'+
                    '</ul>'+
                    '<p class="Move-120h">預測 96-120 小時平均移向移速為</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>西 時速 26 公里</li>'+
                        '<li>預測 10月29日14時</li>'+
                        '<li>中心位置在北緯 15.8 度，東經 155.2 度</li>'+
                        '<li>中心氣壓925百帕</li>'+
                        '<li>近中心最大風速每秒 51 公尺</li>'+
                        '<li>瞬間最大陣風每秒 63 公尺</li>'+
                        '<li>七級風暴風半徑 200 公里</li>'+
                        '<li>十級風暴風半徑 70 公里</li>'+
                        '<li>70%機率半徑 460 公里</li>'+
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
                    '<span class="fa-red">SEVERE TROPICAL STORM</span><br><span class="fa-blue">CHAMPI (202629)</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<p>Position 240600Z at 26.8N 123.2E, Movement: N 19km/h. <span class="fa-blue">Minimum pressure 975 hPa, Max sustained winds near center 30 meter per second</span>, Gusts 38 meter per second, Average radius of over 15m/s winds 200km(160km NW quad. , 240km NE quad. , 140km SW quad. , 240km SE quad. ), Average radius of over 25m/s winds 70km(50km NW quad. , 80km NE quad. , 50km SW quad. , 80km SE quad. ).</p>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default" id="IN-FA">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-1" href="#collapse-A2" title="Check more details" aria-expanded="false">'+
                    '<span class="fa-red">TROPICAL STORM</span><br><span class="fa-blue">IN-FA (202630)</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-A2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<p>Position 240600Z at 10.1N 166.0E, Movement: NNW 6km/h. <span class="fa-blue">Minimum pressure 995 hPa, Max sustained winds near center 20 meter per second</span>, Gusts 28 meter per second, Average radius of over 15m/s winds 80km(100km NW quad. , 80km NE quad. , 80km SW quad. , 60km SE quad. ), Average radius of over 25m/s winds -km.</p>'+
            '</div>'+
        '</div>'+
    '</div>';
TY_LIST_2['E'] = ''+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B1" title="Check more details" aria-expanded="true">'+
                    '<span class="fa-red">SEVERE TROPICAL STORM</span><br><span class="fa-blue">CHAMPI (202629)</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B1" class="panel-collapse collapse in" aria-expanded="true" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">Analysis</span>'+
                    '<p>0600UTC 24 October 2026</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>Center Location 26.8N 123.2E</li>'+
                        '<li>Movement N 33km/h</li>'+
                        '<li>Minimum Pressure 975 hPa</li>'+
                        '<li>Maximum Wind Speed 30 m/s</li>'+
                        '<li>Gust 38 m/s</li>'+
                        '<li>Average radius of over 15m/s winds 200km<br>　160km NW quad.  240km NE quad. <br>　140km SW quad.  240km SE quad. </li>'+
                        '<li>Average radius of over 25m/s winds 70km<br>　50km NW quad.  80km NE quad. <br>　50km SW quad.  80km SE quad. </li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">Forecast</span>'+
                    '<p>6 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1200UTC 24 October 2026</li>'+
                        '<li>Center Position 27.7N 123.3E</li>'+
                        '<li>Vector to 6 HR Position</li>'+
                        '<li>N 19 km/h</li>'+
                        '<li>Minimum Pressure 980 hPa</li>'+
                        '<li>Maximum Wind Speed 28 m/s</li>'+
                        '<li>Gust 35 m/s</li>'+
                        '<li>Radius of over 15m/s winds 180km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 30km</li>'+
                    '</ul>'+
                    '<p>12 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1800UTC 24 October 2026</li>'+
                        '<li>Center Position 28.6N 123.7E</li>'+
                        '<li>Vector to 12 HR Position</li>'+
                        '<li>NNE 18 km/h</li>'+
                        '<li>Minimum Pressure 985 hPa</li>'+
                        '<li>Maximum Wind Speed 25 m/s</li>'+
                        '<li>Gust 33 m/s</li>'+
                        '<li>Radius of over 15m/s winds 180km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 40km</li>'+
                    '</ul>'+
                    '<p>18 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 25 October 2026</li>'+
                        '<li>Center Position 29.4N 124.4E</li>'+
                        '<li>Vector to 18 HR Position</li>'+
                        '<li>NE 19 km/h</li>'+
                        '<li>Minimum Pressure 988 hPa</li>'+
                        '<li>Maximum Wind Speed 23 m/s</li>'+
                        '<li>Gust 30 m/s</li>'+
                        '<li>Radius of over 15m/s winds 150km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 80km</li>'+
                    '</ul>'+
                    '<p>24 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 25 October 2026</li>'+
                        '<li>Center Position 30.2N 125.3E</li>'+
                        '<li>Vector to 24 HR Position</li>'+
                        '<li>NE 21 km/h</li>'+
                        '<li>Minimum Pressure 995 hPa</li>'+
                        '<li>Maximum Wind Speed 20 m/s</li>'+
                        '<li>Gust 28 m/s</li>'+
                        '<li>Radius of over 15m/s winds 150km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 90km</li>'+
                    '</ul>'+
                    '<p>36 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1800UTC 25 October 2026</li>'+
                        '<li>Center Position 31.6N 127.6E</li>'+
                        '<li>Vector to 36 HR Position</li>'+
                        '<li>NE 22 km/h</li>'+
                        '<li>Minimum Pressure 998 hPa</li>'+
                        '<li>Maximum Wind Speed 18 m/s</li>'+
                        '<li>Gust 25 m/s</li>'+
                        '<li>Radius of over 15m/s winds 120km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 110km</li>'+
                    '</ul>'+
                    '<p>48 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 26 October 2026</li>'+
                        '<li>Center Position 32.9N 131.9E</li>'+
                        '<li>Vector to 48 HR Position</li>'+
                        '<li>ENE 36 km/h</li>'+
                        '<li>Minimum Pressure 1005 hPa</li>'+
                        '<li>Maximum Wind Speed  m/s</li>'+
                        '<li>Gust  m/s</li>'+
                        '<li>Radius of 70% probability circle 130km</li>'+
                        '<li>Becoming extratropical low at 48 hours</li>'+
                    '</ul>'+
                '</div>'+
            '</div>'+
        '</div>'+
    '</div>'+
    '<div class="panel panel-default">'+
        '<div class="panel-heading">'+
            '<h4 class="panel-title">'+
                '<a class="accordion-toggle collapsed" data-toggle="collapse" data-parent="#accordion-2" href="#collapse-B2" title="Check more details" aria-expanded="false">'+
                    '<span class="fa-red">TROPICAL STORM</span><br><span class="fa-blue">IN-FA (202630)</span>'+
                '</a>'+
            '</h4>'+
        '</div>'+
        '<div id="collapse-B2" class="panel-collapse collapse" aria-expanded="false" role="document">'+
            '<div class="panel-body">'+
                '<div class="typ-path">'+
                    '<span class="now">Analysis</span>'+
                    '<p>0600UTC 24 October 2026</p>'+
                    '<ul class="list-unstyled">'+
                        '<li>Center Location 10.1N 166.0E</li>'+
                        '<li>Movement W 4km/h</li>'+
                        '<li>Minimum Pressure 995 hPa</li>'+
                        '<li>Maximum Wind Speed 20 m/s</li>'+
                        '<li>Gust 28 m/s</li>'+
                        '<li>Average radius of over 15m/s winds 80km<br>　100km NW quad.  80km NE quad. <br>　80km SW quad.  60km SE quad. </li>'+
                        '<li>Average radius of over 25m/s winds -km</li>'+
                    '</ul>'+
                '</div>'+
                '<div class="typ-path">'+
                    '<span class="prediction">Forecast</span>'+
                    '<p>6 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1200UTC 24 October 2026</li>'+
                        '<li>Center Position 10.4N 165.9E</li>'+
                        '<li>Vector to 6 HR Position</li>'+
                        '<li>NNW 6 km/h</li>'+
                        '<li>Minimum Pressure 988 hPa</li>'+
                        '<li>Maximum Wind Speed 23 m/s</li>'+
                        '<li>Gust 30 m/s</li>'+
                        '<li>Radius of over 15m/s winds 100km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 30km</li>'+
                    '</ul>'+
                    '<p>12 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1800UTC 24 October 2026</li>'+
                        '<li>Center Position 10.9N 165.8E</li>'+
                        '<li>Vector to 12 HR Position</li>'+
                        '<li>NNW 9 km/h</li>'+
                        '<li>Minimum Pressure 985 hPa</li>'+
                        '<li>Maximum Wind Speed 25 m/s</li>'+
                        '<li>Gust 33 m/s</li>'+
                        '<li>Radius of over 15m/s winds 120km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 40km</li>'+
                    '</ul>'+
                    '<p>18 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0000UTC 25 October 2026</li>'+
                        '<li>Center Position 11.5N 165.5E</li>'+
                        '<li>Vector to 18 HR Position</li>'+
                        '<li>NNW 12 km/h</li>'+
                        '<li>Minimum Pressure 980 hPa</li>'+
                        '<li>Maximum Wind Speed 28 m/s</li>'+
                        '<li>Gust 35 m/s</li>'+
                        '<li>Radius of over 15m/s winds 120km</li>'+
                        '<li>Radius of over 25m/s winds -km</li>'+
                        '<li>Radius of 70% probability circle 80km</li>'+
                    '</ul>'+
                    '<p>24 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 25 October 2026</li>'+
                        '<li>Center Position 12.2N 165.1E</li>'+
                        '<li>Vector to 24 HR Position</li>'+
                        '<li>NNW 15 km/h</li>'+
                        '<li>Minimum Pressure 970 hPa</li>'+
                        '<li>Maximum Wind Speed 33 m/s</li>'+
                        '<li>Gust 43 m/s</li>'+
                        '<li>Radius of over 15m/s winds 150km</li>'+
                        '<li>Radius of over 25m/s winds 50km</li>'+
                        '<li>Radius of 70% probability circle 90km</li>'+
                    '</ul>'+
                    '<p>36 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>1800UTC 25 October 2026</li>'+
                        '<li>Center Position 13.2N 164.2E</li>'+
                        '<li>Vector to 36 HR Position</li>'+
                        '<li>NW 12 km/h</li>'+
                        '<li>Minimum Pressure 960 hPa</li>'+
                        '<li>Maximum Wind Speed 38 m/s</li>'+
                        '<li>Gust 48 m/s</li>'+
                        '<li>Radius of over 15m/s winds 180km</li>'+
                        '<li>Radius of over 25m/s winds 60km</li>'+
                        '<li>Radius of 70% probability circle 100km</li>'+
                    '</ul>'+
                    '<p>48 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 26 October 2026</li>'+
                        '<li>Center Position 14.0N 163.9E</li>'+
                        '<li>Vector to 48 HR Position</li>'+
                        '<li>NNW 8 km/h</li>'+
                        '<li>Minimum Pressure 950 hPa</li>'+
                        '<li>Maximum Wind Speed 40 m/s</li>'+
                        '<li>Gust 50 m/s</li>'+
                        '<li>Radius of over 15m/s winds 200km</li>'+
                        '<li>Radius of over 25m/s winds 70km</li>'+
                        '<li>Radius of 70% probability circle 130km</li>'+
                    '</ul>'+
                    '<p>72 hours valid at:</p>'+
                    '<ul class="list-unstyled ">'+
                        '<li>0600UTC 27 October 2026</li>'+
                        '<li>Center Position 14.6N 163.8E</li>'+
                        '<li>Vector to 72 HR Position</li>'+
                        '<li>N Slowly</li>'+
                        '<li>Minimum Pressure 930 hPa</li>'+
                        '<li>Maximum Wind Speed 48 m/s</li>'+
                        '<li>Gust 58 m/s</li>'+
                        '<li>Radius of over 15m/s winds 200km</li>'+
                        '<li>Radius of over 25m/s winds 70km</li>'+
                        '<li>Radius of 70% probability circle 200km</li>'+
                    '</ul>'+
                    '<p class="Move-120h">96 hours valid at:</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>0600UTC 28 October 2026</li>'+
                        '<li>Center Position 15.0N 161.0E</li>'+
                        '<li>Vector to 96 HR Position</li>'+
                        '<li>W 13 km/h</li>'+
                        '<li>Minimum Pressure 925 hPa</li>'+
                        '<li>Maximum Wind Speed 51 m/s</li>'+
                        '<li>Gust 63 m/s</li>'+
                        '<li>Radius of over 15m/s winds 200km</li>'+
                        '<li>Radius of over 25m/s winds 70km</li>'+
                        '<li>Radius of 70% probability circle 360km</li>'+
                    '</ul>'+
                    '<p class="Move-120h">120 hours valid at:</p>'+
                    '<ul class="list-unstyled Move-120h">'+
                        '<li>0600UTC 29 October 2026</li>'+
                        '<li>Center Position 15.8N 155.2E</li>'+
                        '<li>Vector to 120 HR Position</li>'+
                        '<li>W 26 km/h</li>'+
                        '<li>Minimum Pressure 925 hPa</li>'+
                        '<li>Maximum Wind Speed 51 m/s</li>'+
                        '<li>Gust 63 m/s</li>'+
                        '<li>Radius of over 15m/s winds 200km</li>'+
                        '<li>Radius of over 25m/s winds 70km</li>'+
                        '<li>Radius of 70% probability circle 460km</li>'+
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
                '<p>北 時速 19 公里'+
                    '<br /> 預測 10月24日20時'+
                    '<br /> 中心位置在北緯 27.7 度，東經 123.3 度'+
                    '<br /> 中心氣壓980百帕'+
                    '<br /> 近中心最大風速每秒 28 公尺'+
                    '<br /> 瞬間最大陣風每秒 35 公尺'+
                    '<br /> 七級風暴風半徑 180 公里'+
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
                '<p>北北東 時速 18 公里'+
                    '<br /> 預測 10月25日02時'+
                    '<br /> 中心位置在北緯 28.6 度，東經 123.7 度'+
                    '<br /> 中心氣壓985百帕'+
                    '<br /> 近中心最大風速每秒 25 公尺'+
                    '<br /> 瞬間最大陣風每秒 33 公尺'+
                    '<br /> 七級風暴風半徑 180 公里'+
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
                '<p>東北 時速 19 公里'+
                    '<br /> 預測 10月25日08時'+
                    '<br /> 中心位置在北緯 29.4 度，東經 124.4 度'+
                    '<br /> 中心氣壓988百帕'+
                    '<br /> 近中心最大風速每秒 23 公尺'+
                    '<br /> 瞬間最大陣風每秒 30 公尺'+
                    '<br /> 七級風暴風半徑 150 公里'+
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
                '<p>東北 時速 21 公里'+
                    '<br /> 預測 10月25日14時'+
                    '<br /> 中心位置在北緯 30.2 度，東經 125.3 度'+
                    '<br /> 中心氣壓995百帕'+
                    '<br /> 近中心最大風速每秒 20 公尺'+
                    '<br /> 瞬間最大陣風每秒 28 公尺'+
                    '<br /> 七級風暴風半徑 150 公里'+
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
                '<p>東北 時速 22 公里'+
                    '<br /> 預測 10月26日02時'+
                    '<br /> 中心位置在北緯 31.6 度，東經 127.6 度'+
                    '<br /> 中心氣壓998百帕'+
                    '<br /> 近中心最大風速每秒 18 公尺'+
                    '<br /> 瞬間最大陣風每秒 25 公尺'+
                    '<br /> 七級風暴風半徑 120 公里'+
                    '<br /> 70%機率半徑 110 公里'+
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
                '<p>東北東 時速 36 公里'+
                    '<br /> 預測 10月26日14時'+
                    '<br /> 中心位置在北緯 32.9 度，東經 131.9 度'+
                    '<br /> 中心氣壓1005百帕'+
                    '<br /> '+
                    '<br /> '+
                    '<br /> 70%機率半徑 130 公里'+
                    '<br /> 預測 48 小時內變性為溫帶氣旋'+
                '</p>'+
            '</div>'+
        '</div>'+
    '</div>';
