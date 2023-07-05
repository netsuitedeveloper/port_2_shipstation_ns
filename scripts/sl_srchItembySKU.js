var sku = "21229";

//Main Function : Get Item id, 1st try with "name", 2nd try with "itemid"
//function searchItem(sku) {
function suitelet(req, res) {
  nlapiLogExecution("Debug", "Search Item Suitelet" + "is started");

  try {
    nlapiLogExecution("debug", sku);
    var filter = [["name", "is", sku]];

    var item = nlapiSearchRecord(
      "customrecord_scm_customerpartnumber",
      null,
      filter,
      null
    );

    if (item && item.length > 0) {
      var itemid = nlapiLookupField(
        "customrecord_scm_customerpartnumber",
        item[0].getId(),
        "custrecord_scm_cpn_item"
      );
      nlapiLogExecution("debug", "Item ID", itemid);
      return itemid;
    } else {
      nlapiLogExecution("debug", "Else case");
      filter = [["itemid", "is", sku]];
      item = nlapiSearchRecord("inventoryitem", null, filter, null);
      if (item && item.length > 0) {
        nlapiLogExecution("debug", "Item ID", item[0].getId());
        return item[0].getId();
      }
    }
    return null;
  } catch (e) {
    nlapiLogExecution("Debug", "sku not found", sku);
  }
}
