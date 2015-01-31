
/**     @module/class likeness.ValidationError
    @super Error

@member/String code
    A String Error code intended to remain stable and reliable. If you need to branch on the type of
    Error that occured, this is your String. Possible values are:
     * `MISSING` A key was missing, or a `.exists` constraint failed.
     * `TYPE` Specific to the `.type` constraint.
     * `LIMIT` Failues of `.min` and `.max` constraints.
     * `FORMAT` Failures of `.length`, `.value`, `.match`, `sequence`, and `.all`.
     * `ILLEGAL` Unexpected extra keys, keys rejected by `.key` and errors with `.unique`
     * `INVALID` Failures of `.eval`, `.modulo`, `.multiple` and integer type constraints.
     * `SYNC` An asynchronous `.eval` constraint could not be processed.
@member constraint
@member value
@Error|undefined #error
    Errors thrown by `.eval` are wrapped in a ValidationError and stored on the `error` property.
*/

var util = require ('util');

function ValidationError (code, constraint, value, path, message, error) {
    this.code = code;
    this.constraint = constraint;
    this.value = value;
    this.path = path;
    this.message = message;
    if (error) this.error = error;
}
util.inherits (ValidationError, Error);

module.exports = ValidationError;
