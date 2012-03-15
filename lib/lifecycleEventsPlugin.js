/**
 * Mongoose plugin adding lifecyle events on the model class.
 *
 * The model name must be specified during initialization, e.g.:
 *
 *     var lifecycleEventsPlugin = require('path/to/lifecycleEventsPlugin');
 *     var Book = new Schema({ ... });
 *     Book.plugin(lifecycleEventsPlugin, 'Book');
 *
 * Now the model emits lifecycle events on saven insert, update, and remove.
 * You can listen to these events directly on the model.
 *
 * var Book = require('path/to/models/book');
 * Book.on('insert', function(book) {
 *   // do stuff...
 * });
 */
module.exports = exports = function lifecycleEventsPlugin(schema, name) {
  schema.pre('save', function (next) {
    this.model(name).emit('save', this);
    this.isNew ? this.model(name).emit('insert', this) : this.model(name).emit('update', this);
    next();
  });
  schema.pre('remove', function (next) {
    this.model(name).emit('remove', this);
    next();
  });
};