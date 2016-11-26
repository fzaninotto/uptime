var gulp       = require('gulp');
var watch      = require('gulp-watch');
var uglify     = require('gulp-uglify');
var concat     = require('gulp-concat');
var sass       = require('gulp-sass');
var prefix     = require('gulp-autoprefixer');
var plumber    = require('gulp-plumber');
var livereload = require('gulp-livereload');
var gulpFilter = require('gulp-filter');
var minifyCSS  = require('gulp-minify-css');
var rename     = require('gulp-rename');
var ejs        = require('gulp-ejs-precompiler');
var insert     = require('gulp-insert');
var local      = false;

/**
 * Generates CSS from SASS
 * @return {[type]} [description]
 */
gulp.task('sass', function () {
    theTask = gulp.src('./src/scss/style.scss')
        .pipe(plumber())
        .pipe(sass({
            outputStyle: 'compressed'
        }))
        .pipe(prefix('last 2 version'))
        .pipe(gulp.dest('./public/css'));

    if (local)
        theTask.pipe(livereload());
});

/**
 * Copy images
 * @return {[type]} [description]
 */
gulp.task('img', function () {
    theTask = gulp.src('./src/img/**/*')
        .pipe(gulp.dest('./public/img'));

    if (local)
        theTask.pipe(livereload());
});

/**
 * Concat and uglify JS files
 * @return {[type]} [description]
 */
gulp.task('js', function () {
    theTask = gulp.src('./src/js/*.js')
        .pipe(concat('scripts.js'))
        .pipe(uglify())
        .pipe(gulp.dest('./public/js'));

    if (local)
        theTask.pipe(livereload());
});

/**
 * Concat and uglify templates
 * @return {[type]}   [description]
 */
gulp.task('ejs', function () {
    gulp.src('./src/tpl/**/*.ejs')
        .pipe(ejs({
            client: true
        }))
        .pipe(uglify())
        .pipe(concat('templates.js'))
        .pipe(insert.prepend('window.templates = {};'+"\n"))
        .pipe(gulp.dest('./public/js'));

    if (local)
        theTask.pipe(livereload());
});

/**
 * Watch files and run tasks if they change
 * @return {[type]} [description]
 */
gulp.task('watch', function () {
    local = true;
    livereload.listen();

    watch('./src/scss/**/*.{css,scss}', function (files, cb) {
        gulp.start('sass', cb);
    });

    watch('./src/img/**/*', function (files, cb) {
        gulp.start('img', cb);
    });

    watch('./src/js/**/*', function (files, cb) {
        gulp.start('js', cb);
    });

    watch('./src/tpl/**/*.html', function (files, cb) {
        gulp.start('ejs', cb);
    });
});


/**
 * The default task (called when you run `gulp`)
 */
gulp.task('default', [ 'js', 'sass', 'img', 'ejs' ]);