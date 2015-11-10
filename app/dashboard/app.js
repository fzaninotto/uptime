/**
 * Module dependencies.
 */
var express = require('express')
var async = require('async')
//var partials = require('express-partials');
var flash = require('connect-flash')
var engine = require('ejs-mate-gunmetal313')
var moment = require('moment')
var errorhandler = require('errorhandler')
var serveStatic = require('serve-static')
var path = require('path')
var Check = require('../../models/check');
var Tag = require('../../models/tag');
var TagDailyStat = require('../../models/tagDailyStat');
var TagMonthlyStat = require('../../models/tagMonthlyStat');
var CheckMonthlyStat = require('../../models/checkMonthlyStat');
var moduleInfo = require('../../package.json');

var app = module.exports = express()

// middleware
app.use(flash());
app.use(function locals(req, res, next) {
  res.locals.route = app.route;
  res.locals.addedCss = [];
  res.locals.renderCssTags = function(all) {
    if (all != undefined) {
      return all.map(function(css) {
        return '<link rel="stylesheet" href="' + app.route + '/stylesheets/' + css + '">';
      }).join('\n ');
    }
    else {
      return '';
    }
  };
  res.locals.moment = moment;
  next();
});
app.engine('ejs', engine);
app.set('views',__dirname + '/views');
app.use('/',serveStatic(__dirname + '/public'))
app.set('view engine', 'ejs');

var env = process.env.NODE_ENV || 'development';
if ('development' == env) {
  app.use(errorhandler({
    dumpExceptions: true,
    showStack: true
  }));
}

var env = process.env.NODE_ENV || 'production';
if ('production' == env) {
  app.use(errorhandler());
}

app.locals.version = moduleInfo.version;

// Routes

app.get('/events', function(req, res) {
  res.render('events',  { route_path: '/dashboard' } );
});

app.get('/checks', function(req, res, next) {
  Check.find().sort({
    isUp: 1,
    lastChanged: -1
  }).exec(function(err, checks) {
    if (err) return next(err);
    res.render('checks', {
      info: req.flash('info'),
      checks: checks
    });
  });
});

app.get('/checks/new', function(req, res) {
  res.render('check_new', {
    check: new Check(),
    pollerCollection: app.get('pollerCollection'),
    info: req.flash('info')
  });
});

app.post('/checks', function(req, res, next) {
  var check = new Check();
  try {
    var dirtyCheck = req.body.check;
    check.populateFromDirtyCheck(dirtyCheck, app.get('pollerCollection'))
    app.emit('populateFromDirtyCheck', check, dirtyCheck, check.type);
  }
  catch (err) {
    return next(err);
  }
  check.save(function(err) {
    if (err) return next(err);
    req.flash('info', 'New check has been created');
    res.redirect(app.route + (req.body.saveandadd ? '/checks/new' : ('/checks/' + check._id + '?type=hour&date=' + Date.now())));
  });
});

app.get('/checks/:id', function(req, res, next) {
  Check.findOne({
    _id: req.params.id
  }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    res.render('check', {
      check: check,
      info: req.flash('info'),
      req: req
    });
  });
});

app.get('/checks/:id/edit', function(req, res, next) {
  Check.findOne({
    _id: req.params.id
  }, function(err, check) {
    if (err) return next(err);
    if (!check) return res.send(404, 'failed to load check ' + req.params.id);
    var pollerDetails = [];
    app.emit('checkEdit', check.type, check, pollerDetails);
    res.render('check_edit', {
      check: check,
      pollerCollection: app.get('pollerCollection'),
      pollerDetails: pollerDetails.join(''),
      info: req.flash('info'),
      req: req
    });
  });
});

app.get('/pollerPartial/:type', function(req, res, next) {
  var poller;
  try {
    poller = app.get('pollerCollection').getForType(req.params.type);
  }
  catch (err) {
    return next(err);
  }
  var pollerDetails = [];
  app.emit('checkEdit', req.params.type, new Check(), pollerDetails);
  res.send(pollerDetails.join(''));
});

app.put('/checks/:id', function(req, res, next) {
  Check.findById(req.params.id, function(err, check) {
    if (err) return next(err);
    try {
      var dirtyCheck = req.body.check;
      check.populateFromDirtyCheck(dirtyCheck, app.get('pollerCollection'))
      app.emit('populateFromDirtyCheck', check, dirtyCheck, check.type);
    }
    catch (populationError) {
      return next(populationError);
    }
    check.save(function(err2) {
      if (err2) return next(err2);
      req.flash('info', 'Changes have been saved');
      res.redirect(app.route + '/checks/' + req.params.id);
    });
  });
});

app.delete('/checks/:id', function(req, res, next) {
  Check.findOne({
    _id: req.params.id
  }, function(err, check) {
    if (err) return next(err);
    if (!check) return next(new Error('failed to load check ' + req.params.id));
    check.remove(function(err2) {
      if (err2) return next(err2);
      req.flash('info', 'Check has been deleted');
      res.redirect(app.route + '/checks');
    });
  });
});

app.get('/tags', function(req, res, next) {
  Tag.find().sort({
    name: 1
  }).exec(function(err, tags) {
    if (err) return next(err);
    res.render('tags', {
      tags: tags
    });
  });
});

app.get('/tags/:name', function(req, res, next) {
  Tag.findOne({
    name: req.params.name
  }, function(err, tag) {
    if (err) {
      return next(err);
    }
    if (!tag) return next(new Error('failed to load tag ' + req.params.name));
    res.render('tag', {
      tag: tag,
      req: req
    });
  });
});

if (!module.parent) {
  app.listen(3000);
  console.log('Express started on port 3000');
}
