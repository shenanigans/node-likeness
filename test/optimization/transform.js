
var likeness = require ('../../likeness');

var reason = { 2:"not", 4:"never", 6:"maybe" };
function isOptimized (fn) {
    var status = %GetOptimizationStatus(fn);
    if (!(status == 1 || status == 3))
        throw new Error ('not optimized (' + reason[status] + ')');
}

describe ("transforms", function(){

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

    schema.transform ({}, doc);
    schema.transform ({}, doc);

    it ("optimizes #transform", function(){
        schema.transform ({}, doc);
        isOptimized (schema.transform);
    });

    describe ("transformer Functions", function(){

        it ("optimizes Number transformer", function(){
            schema.transform ({}, doc);
            isOptimized (likeness.util.TypeTransformers.number);
        });

        it ("optimizes String transformer", function(){
            schema.transform ({}, doc);
            isOptimized (likeness.util.TypeTransformers.string);
        });

        it ("optimizes Object transformer", function(){
            schema.transform ({}, doc);
            isOptimized (likeness.util.TypeTransformers.object);
        });

        it ("optimizes Array transformer", function(){
            schema.transform ({}, doc);
            isOptimized (likeness.util.TypeTransformers.array);
        });

    });

});
