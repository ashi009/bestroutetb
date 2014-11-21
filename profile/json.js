module.exports = function(Formatter) {

function JsonFormatter() {
}
$inherit(JsonFormatter, Formatter, {
  format: function(rules) {
    return JSON.stringify(rules, null, 2);
  }
});

return {
  '%': {
    Formatter: JsonFormatter
  }
};

};
