
var optimo = require ('./optimization');
optimo.start();

require ('./likeness');
require ('./JSONSchema');

// currently, the optimizing compiler fails everywhere
// at minimum, the .cast constraint must be refactored
// optimo.test();
