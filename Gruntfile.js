module.exports = function(grunt) {

  grunt.initConfig({
    watch: {
      js: {
        files: [
          'app.js',
          'app/api/**/*.js',
          'app/api/app.js'
        ],
        tasks: ['develop'],
        options: { nospawn: true }
      }
    },
    develop: {
      server: {
        file: 'app.js',
        nodeArgs: ['--debug'],            // optional
        env: { NODE_ENV: 'development'}      // optional
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-develop');

  grunt.registerTask('default', ['watch']);

};
