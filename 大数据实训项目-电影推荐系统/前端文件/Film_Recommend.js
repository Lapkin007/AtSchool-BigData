    /**
     * Created by linziyu on 2018/7/3.
     */
    /**
     * express接收html传递的参数
     */
     
    var  express=require('express');
    var  bodyParser = require('body-parser')
   // var spawnSync = require('child_process').spawnSync;
   // const child_process = require('child_process')
    var exec= require('child_process').exec;
    var  app=express();
    var mysql=require('mysql');
    var http = require("http");
    //require('jade');
    app.set('view engine', 'jade');
    app.set('views', './views');
    app.use(bodyParser.urlencoded({extended: false}))
    app.use(bodyParser.json())


    /**
     * 配置MySQL
     */
    var connection = mysql.createConnection({
        host     : '127.0.0.1',
        user     : 'root',
        password : '',
        database : 'movierecommend',
        port:'3306'
    });
    connection.connect();

    /**
     * 跳转到网站首页
     */
    app.get('/',function (req, res) {
        res.render('index');
    })

    /**
     * 跳转到登录页面
     */
    
    app.get('/loginpage',function (req, res) {
      res.render('loginpage',{title:'登录'});
    })

     
    /**
     * 实现登录验证功能
     */
    app.post('/login',function (req, res) {
        var  name=req.body.username.trim();
        var pwd=req.body.pwd.trim();
	console.log('username:'+name+'password:'+pwd);
        var selectMovieInfoSQL="select movieid,moviename,picture from movieinfo limit 1000";
        var movieinfolist=[];
	connection.query(selectMovieInfoSQL,function(err,rows,fields){
	   if (err) throw  err;
	   //console.log('movieids length is:'+rows.length);
	   //console.log('movieid is:'+rows[0].movieid);
           //console.log('moviename is:'+rows[0].moviename);
           movieinfolist=rows;
           });
        
        var selectSQL = "select * from user where username = '"+name+"' and password = '"+pwd+"'";
        connection.query(selectSQL,function (err,rows,fields) {

            if (err) throw  err;
            function randomFrom(lowerValue,upperValue)
{
    return Math.floor(Math.random() * (upperValue - lowerValue + 1) + lowerValue);
}

            //console.log('userid is:'+rows[0].userid);

            var lowerValue=0;
            var upperValue=movieinfolist.length;
            var index=randomFrom(lowerValue,upperValue);
            //console.log('movieid random is:'+movieinfolist[index].movieid);
            //console.log('moviename random is:'+movieinfolist[index].moviename);
            var movielist=[];
            var movieNumbers=10;
            for (var i=0;i<movieNumbers;i++){
              index=randomFrom(lowerValue,upperValue);
              movielist.push({movieid:movieinfolist[index].movieid,moviename:movieinfolist[index].moviename,picture:movieinfolist[index].picture});
              
}

            //for(var item in movielist){
            //  console.log('item is:'+item);
            //  console.log('movieid is:'+movielist[item].movieid);
            //  console.log('moviename is:'+movielist[item].moviename);
            //}
            //判断数据库有没有读取到值，没有就是长度为0，然后返回登陆界面，好像没有忘记密码的节目，就返回原本的界面
            if(rows.length != 0)
            {
                res.render('personalratings',{title:'Welcome User',userid:rows[0].userid,username:rows[0].username,movieforpage:movielist});
            }
            else
            {
                res.render('loginpage',{title:'登录'});
            }
            //res.render('personalratings',{title:'Welcome User',userid:rows[0].userid,username:rows[0].username,movieforpage:movielist});
    });
});

    /**
     * 跳转到注册页面
     */
     
    app.get('/registerpage',function (req, res) {
      res.render('registerpage',{title:'注册'});
    })
     
    /**
     * 实现注册功能
     */
    app.post('/register',function (req, res) {
        var  name=req.body.username.trim();
        var  pwd=req.body.pwd.trim();
        var  user={username:name,password:pwd};
        connection.query('insert into user set ?',user,function (err,rs) {
            if (err) throw  err;
            console.log('register success');
           res.render('registersuccess',{title:'注册成功',message:name});
        })
    })
    /**
     * 把用户评分写入数据库
     */
     
    app.post('/submituserscore',function (req, res) {
        var  userid=req.body.userid;
        var moviescores=[];
        var movieids=[];
        req.body.moviescore.forEach(function(score){
            //console.log('the score is:'+score);
            moviescores.push({moviescore:score});
        });
        req.body.movieid.forEach(function(id){
            //console.log('the id is:'+id);
            movieids.push({movieid:id});
        });

        //for(var item in movieids){
        //   console.log('item is:'+item);
        //   console.log('movieid is:'+movieids[item].movieid);
        //}
        //for(var item in moviescores){
        //   console.log('item is:'+item);
        //   console.log('moviescore is:'+moviescores[item].moviescore);
        //}
        //删除该用户历史评分数据，为写入本次最新评分数据做准备
        connection.query('delete from  personalratings where userid='+userid, function(err, result) {
            if (err) throw err;
            console.log('deleted');
            //console.log(result);
            //console.log('\n');
        });
        //生成评分时间戳
        var mytimestamp =new Date().getTime().toString().slice(1,10);        
        //console.log('mytimestamp2 is:'+mytimestamp);
        for(var item in movieids){
           //把每条评分记录(userid,movieid,rating,timestamp)插入数据库  
           var personalratings={userid:userid,movieid:movieids[item].movieid,rating:moviescores[item].moviescore,timestamp:mytimestamp};
           connection.query('insert into personalratings set ?',personalratings,function (err,rs) {
            if (err) throw  err;
            console.log('insert into personalrating success');          
           });
        }
        var selectUserIdNameSQL='select userid,username from user where userid='+userid;
        connection.query(selectUserIdNameSQL,function(err,rows,fields){
           if (err) throw  err;
           res.render('userscoresuccess',{title:'Personal Rating Success',user:rows[0]});
        });
    
    }); 

    /**
     * 调用Spark程序为用户推荐电影并把推荐结果写入数据库,把推荐结果显示到网页
     */     
    app.get('/recommendmovieforuser',function (req, res) {
	//console.log('result point 1');
        var userid=req.query.userid;
        var username=req.query.username;
        var obj={data:[],error:0}
        //console.log('recommendation userid is:'+userid);      
        var path = 'E:\\z-bigdata\\movie_recommend\\movie_recommend';
        //调用Spark程序为用户推荐电影并把推荐结果写入数据库
        //var spark_submit = spawnSync('/usr/local/spark/bin/spark-submit',['--class', 'recommend.MovieLensALS',' ~/IdeaProjects/Film_Recommend/out/artifacts/Film_Recommend_jar/Film_Recommend.jar', path, userid],{ shell:true, encoding: 'utf8' });
        //console.log('spark running result is:'+spark_submit.stdout);

        var cmd="spark-submit E:\\wocn.jar"+" "+path+" "+userid
        //var cmd="spark-submit Film_Recommend.jar "+""+userid
        //var cmd="spark-submit public/Film_Recommend_jar/Film_Recommend.jar "+""+userid
        //var workerProcess = child_process.exec(cmd, function (error, stdout, stderr) {
            exec(cmd, function(err, stdout, stderr) {undefined
            if(err){ return console.log(err); }})
        //从数据库中读取推荐结果,把推荐结果显示到网页
        var selectRecommendResultSQL="select recommendresult.userid,recommendresult.movieid,recommendresult.rating,recommendresult.moviename,movieinfo.picture from recommendresult inner join movieinfo on recommendresult.movieid=movieinfo.movieid where recommendresult.userid="+userid;
        var movieinfolist=[];
        connection.query(selectRecommendResultSQL,function(err,rows,fields){
            console.log(rows)
           if (err) throw  err;
           //console.log('result point 3');
           //console.log('movieids length is:'+rows.length);
           //console.log('movieid is:'+rows[0].movieid);
           //console.log('moviename is:'+rows[0].moviename);
           console.log('read recommend result from database');
           
           for (var i=0;i<rows.length;i++){
              console.log('forxunhuan:i='+i);
              movieinfolist.push({userid:rows[i].userid,movieid:rows[i].movieid,rating:rows[i].rating,moviename:rows[i].moviename,picture:rows[i].picture});
           }

           //for(var item in movieinfolist){
           //   console.log('result point 6');
           //   console.log('item is:'+item);
           //   console.log('userid is:'+movieinfolist[item].userid);
           //   console.log('movieid is:'+movieinfolist[item].movieid);
           //   console.log('moviename is:'+movieinfolist[item].moviename);
           //   console.log('rating is:'+movieinfolist[item].rating);
           //   console.log('picture is:'+movieinfolist[item].picture);
           //}

           res.render('recommendresult', {title: 'Recommend Result', message: 'this is recommend for you',username:username,movieinfo:movieinfolist})
           });

    })    
 
    var  server=app.listen(3001,function () {
        console.log("movierecommend server start......");
    })

    module.exports.app=app