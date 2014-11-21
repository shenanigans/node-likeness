
var async = require ('async');

var typeGetter = ({}).toString;
try { Buffer; } catch (err) { Buffer = function(){}; }
function getTypeStr (obj) {
    var tstr = typeGetter.apply(obj).slice(8,-1).toLowerCase();
    if (tstr == 'object')
        if (obj instanceof Buffer) return 'buffer';
        else return tstr;
    if (tstr == 'text') return 'textnode';
    if (tstr == 'comment') return 'commentnode';
    if (tstr.slice(0,4) == 'html') return 'element';
    return tstr;
}

var TYPE_TRANSFORMERS = {
    object:     function (value, target, callback) {
        var targetLen;
        if (this.constraints.max)
            targetLen = Object.keys (target).length;

        // children - async
        if (callback) {

        }

        // children - sync
        var preFilter  =  this.constraints.adHoc && this.constraints.filter;
        var postFilter = !this.constraints.adHoc && this.constraints.filter;
        for (var name in value) {
            // .all
            if (this.constraints.all)
                try {
                    this.constraints.all.validate (value[name]);
                } catch (err) {
                    throw {
                        error:  'transform',
                        msg:    'source value failed .all validation',
                        key:    name,
                        source: err
                    };
                }
            // .drop
            if (this.constraints.drop && Object.hasOwnProperty.call (this.constraints.drop, name))
                continue;
            // .filter
            if (preFilter)
                try {
                    this.constraints.filter.validate (name);
                } catch (err) { continue; /* it's ok, just drop it */ }

            // child processing
            var newValue = value[name];
            if (Object.hasOwnProperty.call (this.children, name)) {
                // known key
                // .filter
                if (postFilter)
                    try {
                        this.constraints.filter.validate (name);
                    } catch (err) { continue; /* it's ok, just drop it */ }

                var childSchema = this.children[name];
                if (!Object.hasOwnProperty.call (target, name)) {
                    // key not found on target
                    // key count issues?
                    if (len && this.constraints.max == len)
                        throw {
                            error:      'transform',
                            msg:        'new source key exceeds maximum key limit',
                            key:        name,
                            constraint: this.constraints.max
                        };

                    try {
                        childSchema.validate (newValue);
                    } catch (err) {
                        throw {
                            error:  'transform',
                            msg:    'source value failed validation while filling an empty key',
                            key:    name,
                            source: err
                        };
                    }
                    target[name] = newValue;
                    if (len) len++;
                    continue;
                }
                if (
                    childSchema.constraints.type == 'object'
                 || childSchema.constraints.type == 'array'
                )
                    childSchema.transform (newValue, target[name]);
                else {
                    childSchema.validate (newValue);
                    target[name] = newValue;
                }
                continue;
            }

            // unknown key
            if (this.constraints.keyTest)
                try {
                    this.constraints.keyTest.validate (name, postValidate)
                } catch (err) {
                    throw {
                        error:  'transform',
                        msg:    'source key rejected by .keyTest',
                        key:    name,
                        source: err
                    };
                }
            else if (!this.constraints.adHoc)
                throw {
                    error:  'illegal',
                    msg:    'found unknown key',
                    key:    name
                };

            if (Object.hasOwnProperty.call (target, name)) {
                target[name] = newValue;
                continue;
            }

            if (len) {
                if (len == this.constraints.max)
                    throw {
                        error:      'transform',
                        msg:        'new source key exceeds maximum key limit',
                        key:        name,
                        constraint: this.constraints.max
                    };
                len++;
            }
            target[name] = newValue;
        }

        return target;
    },
    array:      function (value, target, partial, callback) {

    },
    string:     function (value, target, partial, callback) {

    },
    number:     function (value, target, partial, callback) {

    },
    boolean:    function (value, target, partial, callback) {

    }
};

module.exports = TYPE_TRANSFORMERS;
