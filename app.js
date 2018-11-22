var redshift = require('node-redshift');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var redshiftConfig = require('./rs-config');

var redshiftClient = new redshift(redshiftConfig);

var convertJson = function(data) {
  function dateFormat(date) {
    return (date.getMonth() + 1) + '/' + date.getDate() + '/' +  date.getFullYear();
  }

  var dataArray = []
  for (var i = data.length - 1; i >= 0; i--) {
    var item = data[i];
    if (dataArray.length == 0 || dataArray[dataArray.length - 1].date != dateFormat(item.date)) {
      dataArray.push({date: dateFormat(item.date), values: []})
    }
    dataArray[dataArray.length - 1].values.push({country: item.country, value: parseFloat(item.value)})
  }
  return {data: dataArray}
};

var sendSQLToRedshift = function(sql, response, callback = null) {
  redshiftClient.query(sql, {raw: true})
  .then(function(data){
    try{
      response.json(callback? callback(data) : data);
    }
    catch(err)
    {
      response.status(500).send(err.message);
    }
  })
  .catch(function(err){
    response.status(500).send('Redshift error: ' + err.message);
  });
};

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/test', function(req, res) {
  res.send('Test response');
});

app.get('/rs/tables', function(req, res) {
  sendSQLToRedshift('select * from information_schema.tables', res);
});

app.get('/rs/new_users', function(req, res) {
  sendSQLToRedshift('SELECT createdate as date, signupcountry as country,newusers as value \
                     FROM analytics_sandbox.dd_newuserretention \
                     ORDER BY createdate DESC', res, convertJson);
});

app.get('/rs/d1_retention_rate', function(req, res) {
  sendSQLToRedshift('SELECT createdate as date, signupcountry as country,round(1.0*d1_retained/newusers,2) as value \
                     FROM analytics_sandbox.dd_newuserretention \
                     ORDER BY createdate DESC', res, convertJson);
});

app.get('/rs/d7_retention_rate', function(req, res) {
  sendSQLToRedshift('SELECT createdate as date, signupcountry as country,round(1.0*d7_retained/newusers,2) as value \
                     FROM analytics_sandbox.dd_newuserretention \
                     ORDER BY createdate DESC', res, convertJson);
});

app.get('/rs/w1_retention_rate', function(req, res) {
  sendSQLToRedshift('SELECT createdate as date, signupcountry as country, round(1.0*w1_retained/newusers,2) as value \
                     FROM analytics_sandbox.dd_newuserretention \
                     ORDER BY createdate DESC', res, convertJson);
});

app.get('/rs/dau', function(req, res) {
  sendSQLToRedshift('SELECT active_date as date, country, dau as value \
                     FROM analytics_sandbox.dd_daudetails \
                     ORDER BY active_date DESC', res, convertJson);
});

app.get('/rs/chat_dau', function(req, res) {
  sendSQLToRedshift('SELECT active_date as date, country, round(1.0*chat_dau/dau,2) as value \
                     FROM analytics_sandbox.dd_daudetails \
                     ORDER BY active_date DESC', res, convertJson);
});

app.get('/rs/studio_dau', function(req, res) {
  sendSQLToRedshift('SELECT active_date as date, country, round(1.0*studio_dau/dau,1) as value \
                     FROM analytics_sandbox.dd_daudetails \
                     ORDER BY active_date DESC', res, convertJson);
});

app.get('/rs/ae_dau', function(req, res) {
  sendSQLToRedshift('SELECT active_date as date, country, round(1.0*ae_dau/dau,2) as value \
                     FROM analytics_sandbox.dd_daudetails \
                     ORDER BY active_date DESC', res, convertJson);
});

app.get('/rs/gameplays', function(req, res) {
  sendSQLToRedshift('SELECT play_date as date, country, gameplays as value \
                     FROM analytics_sandbox.dd_gameplays \
                     ORDER BY play_date DESC', res, convertJson);
});

app.get('/rs/ingamehours', function(req, res) {
  sendSQLToRedshift('SELECT play_date as date, country, round(1.0*ingameseconds/3600,2) as value \
                     FROM analytics_sandbox.dd_gameplays \
                     ORDER BY play_date DESC', res, convertJson);
});

app.get('/rs/avg_ingameminutes', function(req, res) {
  sendSQLToRedshift('SELECT play_date as date, country, round(1.0*ingameseconds/(60*unique_players),2) as value \
                     FROM analytics_sandbox.dd_gameplays \
                     ORDER BY play_date DESC', res, convertJson);
});

app.get('/rs/income', function(req, res) {
  sendSQLToRedshift('SELECT solddate as date, country, robuxspent as value \
                     FROM analytics_sandbox.dd_backlogsales \
                     ORDER BY solddate DESC', res, convertJson);
});

app.get('/rs/cashout', function(req, res) {
  sendSQLToRedshift('SELECT cashoutdate as date, country, robux as value \
                     FROM analytics_sandbox.dd_cashout \
                     ORDER BY cashoutdate DESC', res, convertJson);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
