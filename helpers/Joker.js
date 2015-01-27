
/**     @property/Function likeness.helpers.Joker
    Create a schema that represents arbitrary data of any type.
@argument/Boolean optional
    @optional
    Whether the Joker needs to exist at all.
@returns/likeness
    New pre-configured likeness.
*/
function Joker (optional) {
    var options = { '.adHoc':true };
    if (optional) optional['.optional'] = true;

    return new Likeness (options);
}
