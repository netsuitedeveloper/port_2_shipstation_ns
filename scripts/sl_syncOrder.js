function sync(request, response) {
  var so_id = results[i].getId();
  var so_rec = nlapiLoadRecord("salesorder", so_id);
  var reason = "";

  reason = "check_order_existence(otherrefnum):";
  reason = check_order_existence(
    so_id,
    so_rec.getFieldValue("otherrefnum"),
    reason
  );
  if (reason == 1) {
    return null;
  } else {
    reason = reason + "check_order_existence(tranid):";
    reason = check_order_existence(
      so_id,
      so_rec.getFieldValue("tranid"),
      reason
    );
    if (reason == 1) return null;
  }

  reason = reason + "check_lineitem_count:";
  if (!check_lineitem_count(so_rec)) {
    reason = reason + "dropship:SkippedToSync";
    nlapiLogExecution("debug", "dropship:SkippedToSync", "(SO)" + so_id);
    return null;
  }
  reason = reason + "NOTdropship:";

  reason = reason + "checkShipAddr:";
  if (!so_rec.getFieldValue("shipaddress")) {
    reason = reason + "NOshipaddress:SkippedToSync";
    nlapiLogExecution("debug", "NOshipaddress:SkippedToSync", "(SO)" + so_id);
    return null;
  }
  reason = reason + "EXISTshipaddress:";

  // if (!so_rec.getFieldValue('billaddress')) {
  //     nlapiLogExecution('debug', so_id, 'no billaddress');
  //     continue;
  // }

  reason = reason + "check_order_customer:";
  var customerId = so_rec.getFieldValue("entity");
  if (!check_order_customer(customerId)) {
    reason = reason + "uncheckedSyncCheckbox:";
    if (so_rec.getFieldValue("custbody_syncto_shipstation") != "T") {
      reason = reason + "NotSETcustbody_syncto_shipstation:SkippedToSync:";
      nlapiLogExecution(
        "debug",
        "NotSETcustbody_syncto_shipstation:SkippedToSync:",
        "(SO)" + so_id
      );
      return null;
    }
  }
  reason = reason + "PASSEDall:";
  nlapiLogExecution("debug", reason, "(SO)" + so_id);
  nlapiLogExecution("debug", "PASSEDall:", "(SO)" + so_id);
}

function get_cpn(itemid) {
  var filters = new Array();
  filters[0] = new nlobjSearchFilter(
    "custrecord_scm_cpn_item",
    null,
    "is",
    itemid
  );
  var columns = new Array();
  columns[0] = new nlobjSearchColumn("name");
  var searchresults = nlapiSearchRecord(
    "customrecord_scm_customerpartnumber",
    null,
    filters,
    columns
  );
  if (searchresults && searchresults.length > 0) {
    var id = searchresults[0].getValue(columns[0]);
    return id;
  }
  return null;
}

function get_counts(searchResults) {
  var resultIndex = 0;
  var resultStep = 1000; // Number of records returned in one step (maximum is 1000)
  var resultSet; // temporary variable used to store the result set
  var length = 0;
  do {
    resultSet = searchResults.getResults(resultIndex, resultIndex + resultStep);
    resultIndex = resultIndex + resultStep;
    length += resultSet.length;
  } while (resultSet.length > 0);
  return length;
}

// Check in shipstation
function check_order_existence(so_id, ponum, rsn) {
  // Call Shipstation API
  var headers = new Array();
  headers["Authorization"] = authorization;
  headers["Content-Length"] = 0;

  var endpoint = "https://ssapi.shipstation.com/orders";
  var url = endpoint + "?orderNumber=" + ponum;
  var response = nlapiRequestURL(url, null, headers, null, "GET");
  var res = response.getBody();
  response = JSON.parse(res);
  nlapiLogExecution("debug", "response", JSON.stringify(response));
  if (res.indexOf(ponum) != -1) {
    if (
      response.orders[0].advancedOptions.storeId == "295857" ||
      response.orders[0].advancedOptions.storeId == 295857
    ) {
      //    NetSuite	         295857
      reason =
        rsn + "(storeID)" + response.orders[0].advancedOptions.storeId + ":";
      return reason;
    }
    reason =
      rsn +
      "(storeID)" +
      response.orders[0].advancedOptions.storeId +
      ":SkippedToSync";
    nlapiLogExecution(
      "debug",
      "(storeID)" +
        response.orders[0].advancedOptions.storeId +
        ":SkippedToSync",
      "(SO)" + so_id + " (PO)" + ponum
    );
    return 1;
  }
  reason = rsn + "(not exists in shipstation):";
  return reason;
}

// Check in netsuite
function check_so_existence(po) {
  if (!po || po == "null") return null;

  var filter = [];
  filter.push(new nlobjSearchFilter("otherrefnum", null, "equalto", po));
  filter.push(new nlobjSearchFilter("mainline", null, "is", "T"));

  var searchSales = nlapiSearchRecord("salesorder", null, filter);

  if (searchSales && searchSales.length > 0) {
    return searchSales[0].getId();
  } else {
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

function check_lineitem_count(so_rec) {
  var count = so_rec.getLineItemCount("item");
  var ds_count = 0;
  for (var i = 1; i <= count; i++) {
    var createpo = so_rec.getLineItemValue("item", "createpo", i);
    var poid = so_rec.getLineItemValue("item", "poid", i);
    var itype = so_rec.getLineItemValue("item", "itemtype", i);
    if (createpo == "DropShip") {
      ds_count++;
    } else {
      if (itype != "InvtPart") {
        ds_count++;
      }
    }
  }
  if (count > ds_count) return true; //Not Dropship
  return false; //Dropship
}

function check_order_customer(customerId) {
  if (customerId) {
    var customer_data = nlapiLookupField("customer", customerId, [
      "custentity_shipstation_sync",
      "subsidiary",
    ]);
    if (
      customer_data.custentity_shipstation_sync != "T" ||
      customer_data.subsidiary != "1"
    )
      return false;
    return true;
  }
  return false;
}
