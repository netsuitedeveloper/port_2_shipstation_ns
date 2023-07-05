var po = "27635494";

//Main Function : Get Sales Order, 1st try with "otherrefnum", 2nd try with "tranid"
function suitelet(req, res) {
  nlapiLogExecution("Debug", "Search Order Suitelet" + "is started");
  try {
    if (!po || po == "null") return null;

    var filter = [];
    nlapiLogExecution("debug", po);
    filter.push(new nlobjSearchFilter("otherrefnum", null, "equalto", po));
    filter.push(new nlobjSearchFilter("mainline", null, "is", "T"));

    var searchSales = nlapiSearchRecord("salesorder", null, filter);
    nlapiLogExecution("debug", "Search Result", JSON.stringify(searchSales));

    if (searchSales && searchSales.length > 0) {
      nlapiLogExecution("debug", searchSales[0].getId());
      return searchSales[0].getId();
    } else {
      filter = [];
      nlapiLogExecution("debug", po);
      filter.push(new nlobjSearchFilter("tranid", null, "is", po));
      filter.push(new nlobjSearchFilter("mainline", null, "is", "T"));

      var columns = [];
      columns.push(new nlobjSearchColumn("tranid"));

      searchSales = nlapiSearchRecord("salesorder", null, filter, columns);
      nlapiLogExecution("debug", "Search Result", JSON.stringify(searchSales));

      if (searchSales && searchSales.length > 0) {
        for (var i = 0; i < searchSales.length; i++) {
          if (searchSales[i].getValue(columns[0]) == po) {
            nlapiLogExecution("debug", searchSales[i].getId());
            return searchSales[i].getId();
          }
        }
      }
    }
    nlapiLogExecution("debug", "Found Nothing");
  } catch (e) {
    nlapiLogExecution("ERROR", "Fatal Error: " + e);
  }
  return null;
}
