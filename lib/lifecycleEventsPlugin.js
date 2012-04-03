/**
 * Mongoose plugin adding lifecyle events on the model class.
 *
 * Initialization is straightforward:
 *
 *     var lifecycleEventsPlugin = require('path/to/lifecycleEventsPlugin');
 *     var Book = new Schema({ ... });
 *     Book.plugin(lifecycleEventsPlugin);
 *
 * Now the model emits lifecycle events before and after persistence operations:
 *
 *  - preInsert
 *  - postInsert
 *  - preUpdate
 *  - postUpdate
 *  - preSave (called for both inserts and updates)
 *  - postSave (called for both inserts and updates)
 *  - preRemove
 *  - postRemove
 *
 * You can listen to these events directly on the model.
 *
 * var Book = require('path/to/models/book');
 * Book.on('preInsert', function(book) {
 *   // do stuff...
 * });
 */
module.exports = exports = function lifecycleEventsPlugin(schema) {
  schema.pre('save', function (next) {
    var model = this.model(this.constructor.modelName);
    model.emit('preSave', this);
    this.isNew ? model.emit('preInsert', this) : model.emit('preUpdate', this);
    this._isNew_internal = this.isNew;
    next();
  });
  schema.post('save', function() {
    var model = this.model(this.constructor.modelName);
    model.emit('postSave', this);
    this._isNew_internal ? model.emit('postInsert', this) : model.emit('postUpdate', this);
    this._isNew_internal = undefined;
  });
  schema.pre('remove', function (next) {
    this.model(this.constructor.modelName).emit('preRemove', this);
    next();
  });
  schema.post('remove', function() {
    this.model(this.constructor.modelName).emit('postRemove', this);
  });
};