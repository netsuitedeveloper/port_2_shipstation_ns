//Main Function : Get Sales Order, 1st try with "otherrefnum", 2nd try with "tranid"
function suitelet(req, res) {
  var shipment_xml = request.getBody();
  nlapiLogExecution("debug", "POST", shipment_xml);

  var shipment = nlapiStringToXML(shipment_xml);
  var shipnotice = nlapiSelectNode(shipment, "ShipNotice");
  var orderNumber = nlapiSelectValue(shipnotice, "//OrderNumber");
  var carrier = nlapiSelectValue(shipnotice, "//Carrier");
  var service = nlapiSelectValue(shipnotice, "//Service");
  var shipping_cost = nlapiSelectValue(shipnotice, "//ShippingCost");
  var tracking_number = nlapiSelectValue(shipnotice, "//TrackingNumber");
  var orderId = check_so_existence(orderNumber);
  nlapiLogExecution("debug", "tracking_number", tracking_number);
  if (orderId != null) {
    var fulfillment = nlapiTransformRecord(
      "salesorder",
      orderId,
      "itemfulfillment",
      { recordmode: "dynamic" }
    );
    fulfillment.setFieldValue("shipstatus", "C");
    fulfillment.selectLineItem("package", 1);
    fulfillment.setCurrentLineItemValue(
      "package",
      "packagetrackingnumber",
      tracking_number
    );
    fulfillment.commitLineItem("package");
    var fulfillment_id = nlapiSubmitRecord(fulfillment);
    nlapiLogExecution("debug", orderId, fulfillment_id);
    response.write("200");
  } else {
    nlapiLogExecution("debug", "not found order ID", fulfillment_id);

    response.write("500");
  }
}

// Check in netsuite
function check_so_existence(po) {
  if (!po || po == "null") return null;

  nlapiLogExecution("debug", po);
  var filter = [];
  filter.push(new nlobjSearchFilter("otherrefnum", null, "equalto", po));
  filter.push(new nlobjSearchFilter("mainline", null, "is", "T"));

  var searchSales = nlapiSearchRecord("salesorder", null, filter);

  if (searchSales && searchSales.length > 0) {
    return searchSales[0].getId();
  } else {
    nlapiLogExecution("debug", po);

    filter = [];
    filter.push(new nlobjSearchFilter("tranid", null, "is", po));
    filter.push(new nlobjSearchFilter("mainline", null, "is", "T"));

    var columns = [];
    columns.push(new nlobjSearchColumn("tranid"));

    searchSales = nlapiSearchRecord("salesorder", null, filter, columns);

    if (searchSales && searchSales.length > 0) {
      for (var i = 0; i < searchSales.length; i++) {
        if (searchSales[i].getValue(columns[0]) == po) {
          return searchSales[i].getId();
        }
      }
    }
  }
  return null;
}
