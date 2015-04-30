
var likeness = require ('../../../likeness');

var reason = { 2:"not", 4:"never", 6:"maybe" };
function isOptimized (fn) {
    var status = %GetOptimizationStatus(fn);
    if (!(status == 1 || status == 3))
        throw new Error ('not optimized (' + reason[status] + ')');
}

describe ("validations", function(){

    var schema = new likeness ({
        able:       { '.type':'number' },
        baker:      { '.type':'string' },
        charlie:    { '.type':'boolean' },
        dog:        { '.type':'null' },
        easy:       { '.type':'object', able:{ '.type':'string' } },
        fox:        { '.type':'array', '.all':{ '.type':'number' } }
    });

    var doc = {
        able:       10,
        baker:      'ten',
        charlie:    true,
        dog:        null,
        easy:       { able:'twenty' },
        fox:        [ 1, 2, 3 ]
    };

    schema.validate (doc);
    schema.validate (doc);

    it ("optimizes #validate", function(){
        %OptimizeFunctionOnNextCall (schema.validate);
        schema.validate (doc);
        isOptimized (schema.validate);
    });

    describe ("validator Functions", function(){

        it ("optimizes Number validator", function(){
            %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.number);
            schema.validate (doc);
            isOptimized (likeness.util.TypeValidators.number);
        });

        it ("optimizes String validator", function(){
            %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.string);
            schema.validate (doc);
            isOptimized (likeness.util.TypeValidators.string);
        });

        it ("optimizes Object validator", function(){
            %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.object);
            schema.validate (doc);
            isOptimized (likeness.util.TypeValidators.object);
        });

        it ("optimizes Array validator", function(){
            %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.array);
            schema.validate (doc);
            isOptimized (likeness.util.TypeValidators.array);
        });

    });

});
