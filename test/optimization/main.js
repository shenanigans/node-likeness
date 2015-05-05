
var likeness = require ('../../likeness');
var schema = new likeness ({
    able:       { '.type':'number' },
    baker:      { '.type':'string' },
    charlie:    { '.type':'boolean' },
    dog:        { '.type':'null' },
    easy:       { '.type':'object', able:{ '.type':'string' } },
    fox:        { '.type':'array', '.all':{ '.type':'number' } }
});

module.exports = {
    start:  function(){
        %OptimizeFunctionOnNextCall (schema.validate);
        %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.number);
        %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.string);
        %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.object);
        %OptimizeFunctionOnNextCall (likeness.util.TypeValidators.array);
        %OptimizeFunctionOnNextCall (schema.transform);
        %OptimizeFunctionOnNextCall (likeness.util.TypeTransformers.number);
        %OptimizeFunctionOnNextCall (likeness.util.TypeTransformers.string);
        %OptimizeFunctionOnNextCall (likeness.util.TypeTransformers.object);
        %OptimizeFunctionOnNextCall (likeness.util.TypeTransformers.array);
    },
    test:   function(){
        describe ("optimization", function(){
            require ('./validate');
            require ('./transform');
        });
    }
};
