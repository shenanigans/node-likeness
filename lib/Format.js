
var ValidationError = require ('./errors/ValidationError');

/**     @module likeness.Format
    @development
    Perform Web-RFC string format validations. Supports the following formats:
     * `"date-time"` [rfc-3339](https://www.ietf.org/html/rfc3339) timestamps.
     * `"date"`
     * `"time"`
     * `"email"` Supports the most commonly used parts of [rfc-5322](https://tools.ietf.org/html/rfc5322).
     * `"hostname"` [rfc-1034](https://tools.ietf.org/html/rfc1034) internet host names.
     * `"ipv4"` [rfc-2673](https://tools.ietf.org/html/rfc2673) IPv4 addresses.
     * `"ipv6"` [rfc-2373](https://tools.ietf.org/html/rfc2373) IPv6 addresses.
     * `"uri"` [rfc-3986](https://tools.ietf.org/html/rfc3986) universal internet resource identifier.

    Source borrows heavily from [another validating lib]
    (https://github.com/natesilva/jayschema/tree/master/lib/suites/draft-04).
*/

var RE_DATE_TIME = new RegExp (
    '^' +
    '(\\d{4})\\-(\\d{2})\\-(\\d{2})' +        // full-date
    '[T ]' +
    '(\\d{2}):(\\d{2}):(\\d{2})(\\.\\d+)?' +  // partial-time
    '(Z|(?:([\\+|\\-])(\\d{2}):(\\d{2})))' +  // time-offset
    '$'
);

var RE_DATE = new RegExp (
    '^' +
    '(\\d{4})\\-(\\d{2})\\-(\\d{2})' +
    '$'
);

var RE_TIME = new RegExp (
    '^' +
    '(\\d{2}):(\\d{2}):(\\d{2})(\\.\\d+)?' +
    '$'
);

var RE_HOSTNAME = new RegExp (
    '^' +
    '[A-Za-z0-9]' +         // must start with a letter or digit
    '(?:' +
        '[A-Za-z0-9-]*' +     // optional letters/digits/hypens
        '[A-Za-z0-9]' +       // must not end with a hyphen
    ')?' +
    '(?:' +
        '\\.' +
        '[A-Za-z0-9]' +       // must start with a letter or digit
        '(?:' +
            '[A-Za-z0-9-]*' +   // optional letters/digits/hypens
            '[A-Za-z0-9]' +     // must not end with a hyphen
        ')?' +
    ')*' +
    '$'
);

var RE_EMAIL = new RegExp (
    '^' +
    '[A-Za-z0-9!#$%&\'*+=/?^_`{|}~-]+' +
    '(?:\\.[A-Za-z0-9!#$%&\'*+=/?^_`{|}~-]+)*' + // dot-atom
    '@' +
    '(' +
        '[A-Za-z0-9]' +         // must start with a letter or digit
        '(?:' +
            '[A-Za-z0-9-]*' +     // optional letters/digits/hypens
            '[A-Za-z0-9]' +       // must not end with a hyphen
        ')?' +
        '(?:' +
            '\\.' +
            '[A-Za-z0-9]' +       // must start with a letter or digit
            '(?:' +
                '[A-Za-z0-9-]*' +   // optional letters/digits/hypens
                '[A-Za-z0-9]' +     // must not end with a hyphen
            ')?' +
        ')*' +
    ')' +
    '$'
);

var RE_IPV4 = new RegExp (
    '^' +
    '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[0-9]{1,2})' +
    '(?:' +
        '\\.' +
        '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[0-9]{1,2})' +
    '){3}' +
    '$'
);

var RE_IPV6_ALL = new RegExp (
    '^' +
    '[0-9A-Fa-f\\:\\.]{2,45}' +
    '$'
);

var RE_IPV6_FORM1 = new RegExp (
    '^' +
    '[0-9A-Fa-f]{1,4}' +
    '(?:' +
        ':' +
        '[0-9A-Fa-f]{1,4}' +
    '){7}' +
    '$'
);

var RE_IPV6_FORM3 = new RegExp (
    '^' +
    '(' +
    '[0-9A-Fa-f]{1,4}:' +
    '){6}' +
    '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[0-9]{1,2})' +
    '(?:' +
    '\\.' +
    '(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[0-9]{1,2})' +
    '){3}' +
    '$'
);

var RE_URI = new RegExp (
    '^' +
    '([A-Za-z][A-Za-z0-9+.-]*:/{0,3})?' +          // scheme
    '[A-Za-z0-9\\[\\]._~%!$&\'()*+,;=:@/-]*' +  // hier-part
    '(' +
        '[?][A-Za-z0-9._~%!$&\'()*+,;=:@/?-]*' +  // query
    ')?' +
    '(' +
        '#[A-Za-z0-9._~%!$&\'()*+,;=:@/?-]*' +    // fragment
    ')?' +
    '$'
);

module.exports.validate = function (type, str) {
    if (type == 'date-time') {
        var valid = false;
        var match = str.match(RE_DATE_TIME);
        if (!match)
            throw new ValidationError (
                'FORMAT'
            );

        var year = parseInt(match[1], 10);
        var month = parseInt(match[2], 10);
        var mday = parseInt(match[3], 10);
        var hour = parseInt(match[4], 10);
        var min = parseInt(match[5], 10);
        var sec = parseInt(match[6], 10);

        if (
            month < 1 && month > 12
         || mday < 1 && mday > 31
         || hour < 0 && hour > 23
         || min < 0 && min > 59
         || sec < 0 && sec > 60       // it’s 60 during a leap second
        )
            throw new ValidationError (
                'FORMAT'
            );

        var d = new Date(year, (month - 1) + 1);  // the next month
        var lastDay = new Date(d - 86400000);
        if (mday > lastDay.getDate())
            throw new ValidationError (
                'FORMAT'
            );

        if (match[10]) {
            var offsetHour = parseInt(match[10], 10);
            var offsetMin = parseInt(match[11], 10);
            if (offsetHour < 0 || offsetHour > 23 || offsetMin < 0 || offsetMin > 59)
                throw new ValidationError (
                    'FORMAT'
                );
        }
        return;
    }
    if (type == 'date') {
        var valid = false;
        var match = str.match(RE_DATE);
        if (!match)
            throw new ValidationError (
                'FORMAT'
            );

        var year = parseInt(match[1], 10);
        var month = parseInt(match[2], 10);
        var mday = parseInt(match[3], 10);

        if (
            month < 1 && month > 12
         || mday < 1 && mday > 31
        )
            throw new ValidationError (
                'FORMAT'
            );

        var d = new Date(year, (month - 1) + 1);  // the next month
        var lastDay = new Date(d - 86400000);
        if (mday > lastDay.getDate())
            throw new ValidationError (
                'FORMAT'
            );
        return;
    }
    if (type == 'time') {
      var valid = false;
      var match = str.match(RE_TIME);
      if (!match)
        throw new ValidationError (
            'FORMAT'
        );

        var hour = parseInt(match[4], 10);
        var min = parseInt(match[5], 10);
        var sec = parseInt(match[6], 10);

        if (
            hour < 0 && hour > 23
         || min < 0 && min > 59
         || sec < 0 && sec > 60       // it’s 60 during a leap second
        )
            throw new ValidationError (
                'FORMAT'
            );


        if (match[10]) {
            var offsetHour = parseInt(match[10], 10);
            var offsetMin = parseInt(match[11], 10);
            if (offsetHour < 0 || offsetHour > 23 || offsetMin < 0 || offsetMin > 59)
                throw new ValidationError (
                    'FORMAT'
                );
        }
        return;
    }
    if (type == 'hostname') {
        if (!str.match (RE_HOSTNAME))
            throw new ValidationError (
                'FORMAT'
            );
        var frags = str.split ('.');
        for (var i=0,j=frags.length; i<j; i++)
            if (frags[i].length > 63)
                throw new ValidationError (
                    'FORMAT'
                );
        return;
    }
    if (type == 'email') {
        if (!str.match (RE_EMAIL))
            throw new ValidationError (
                'FORMAT',
                'email',
                str
            );
        return;
    }
    if (type == 'ipv4') {
        if (!str.match (RE_IPV4))
            throw new ValidationError (
                'FORMAT'
            );
        return;
    }
    if (type == 'ipv6') {
        if (!str.match (RE_IPV6_FORM1) && !str.match (RE_IPV6_FORM3)) {
            if (!str.match (RE_IPV6_ALL))
                throw new ValidationError (
                    'FORMAT'
                );
            var frags = str.split (':');
            if (frags.length < 3 || frags.length > 8)
                throw new ValidationError (
                    'FORMAT'
                );

            var filledCount = 0;
            for (var i=0, j=frags.length; i<j; i++)
                if (frags[i].length)
                    filledCount++;

            var missingCount;
            if (str.indexOf('.') !== -1)
                missingCount = 7 - filledCount;   // condensed form 3
            else
                missingCount = 8 - filledCount;   // form 2
            var missingParts = new Array(missingCount);
            for (var i=0; i<missingCount; i++)
                missingParts[i] = '0';

            var replacement = ':' + missingParts.join (':') + ':';
            var expanded = str.replace ('::', replacement);

            // trim leading and trailing colons
            if (expanded[0] === ':')
                expanded = expanded.slice(1);
            if (expanded.slice(-1) === ':')
                expanded = expanded.slice(0, -1);

            if (!expanded.match(RE_IPV6_FORM1) && !expanded.match(RE_IPV6_FORM3)) {
                console.log (expanded);
                throw new ValidationError (
                    'FORMAT'
                );
            }
        }
        return;
    }
    if (type == 'uri') {
        if (!str.match (RE_URI))
            throw new ValidationError (
                'FORMAT'
            );
        return;
    }

    throw new ValidationError (
        'INVALID'
    );
};
