//Main Function : Get Sales Order, 1st try with "otherrefnum", 2nd try with "tranid"
function suitelet(req, res) {
  var element = JSON.parse(req.getBody());
  var orderNumber = element.orderNumber;
  var salesorder_po = check_so_existence(orderNumber);
  var str =
    "orderNum: " +
    orderNumber +
    " (storeID: " +
    element.advancedOptions.storeId +
    ")";
  var customer_data = {
    storeId: element.advancedOptions.storeId,
    customerId: element.customerId,
    customerUsername: element.customerUsername,
    email: element.customerEmail,
    billTo: element.billTo,
    shipTo: element.shipTo,
  };
  if (salesorder_po) {
    // already exists in NS
    nlapiLogExecution("debug", str, "already exists. SO id: " + salesorder_po);
  } else {
    if (element.orderStatus == "cancelled") {
      nlapiLogExecution("debug", str, "orderStatus: cancelled");
      return null;
    }
    // needs to be created
    var storeId = element.advancedOptions.storeId;
    var customer_data = {
      storeId: element.advancedOptions.storeId,
      customerId: element.customerId,
      customerUsername: element.customerUsername,
      email: element.customerEmail,
      billTo: element.billTo,
      shipTo: element.shipTo,
    };
    var customerId = null;
    var addressbookId = null;
    switch (storeId) {
      case 210867:
        // New Amazon CA Store, New Amazon Store
        customerId = 337;
        addressbookId = update_customer(customer_data, customerId);
        break;
      case 208234:
        // New Amazon CA Store, New Amazon Store
        customerId = 337;
        addressbookId = update_customer(customer_data, customerId);
        break;
      case 258118:
        // New Ebay Store
        customerId = 1505;
        addressbookId = update_customer(customer_data, customerId);
        break;
      case 224975:
        // New Walmart Store
        customerId = 1545;
        addressbookId = update_customer(customer_data, customerId);
        break;
      case 242435:
        // Shopify
        customerId = 1483;
        addressbookId = update_customer(customer_data, customerId);
        break;
      default:
        var customerId = check_customer_existence(customer_data);
        break;
    }
    if (customerId != null && check_customer_rec(customerId)) {
      var so_id = createSalesOrder(customerId, addressbookId, element);
      nlapiLogExecution(
        "debug",
        so_id + " is created",
        JSON.stringify(element)
      );
    }
  }
}

function format_date(date) {
  var mm = date.getMonth() + 1; // getMonth() is zero-based
  var dd = date.getDate();

  return [
    date.getFullYear(),
    (mm > 9 ? "" : "0") + mm,
    (dd > 9 ? "" : "0") + dd,
  ].join("-");
}

// Check the existence of sales order with the specified #PO
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

// Update marketplace customer
function update_customer(dataIn, id) {
  var addr_info = dataIn.shipTo;
  var customerRec = nlapiLoadRecord("customer", id);
  var lines = customerRec.getLineItemCount("addressbook");
  if (lines > 0) {
    for (var k = 1; k <= lines; k++) {
      var custZip = customerRec.getLineItemValue(
        "addressbook",
        "zip_initialvalue",
        k
      );
      var custAddr1 = customerRec.getLineItemValue(
        "addressbook",
        "addr1_initialvalue",
        k
      );
      if (custZip == addr_info.postalCode && custAddr1 == addr_info.street1) {
        nlapiLogExecution(
          "debug",
          id +
            ":" +
            customerRec.getLineItemValue("addressbook", "addressid", k),
          JSON.stringify(dataIn)
        );
        return customerRec.getLineItemValue("addressbook", "addressid", k);
      }
    }
  }

  customerRec.selectNewLineItem("addressbook");
  customerRec.setCurrentLineItemValue(
    "addressbook",
    "label",
    addr_info.street1
  );

  var subRecord = customerRec.createCurrentLineItemSubrecord(
    "addressbook",
    "addressbookaddress"
  );
  subRecord.setFieldValue("country", addr_info.country);

  if (addr_info.street1 != "null" && addr_info.street1 != null) {
    subRecord.setFieldValue("addr1", addr_info.street1);
  } else {
    subRecord.setFieldValue("addr1", "");
  }

  if (addr_info.street2 != "null" && addr_info.street2 != null) {
    subRecord.setFieldValue("addr2", addr_info.street2);
  } else {
    subRecord.setFieldValue("addr2", "");
  }

  subRecord.setFieldValue("zip", addr_info.postalCode);
  subRecord.setFieldValue("state", addr_info.state);
  subRecord.setFieldValue("city", addr_info.city);

  subRecord.commit();

  customerRec.setCurrentLineItemValue("addressbook", "defaultshipping", "T");
  customerRec.commitLineItem("addressbook");

  var submitedId = nlapiSubmitRecord(customerRec);
  return null;
}

// Check the existence of customer with the specified email address
function check_customer_existence(dataIn) {
  var email = dataIn.email;
  var addr_info = dataIn.shipTo;
  var filters = new Array();
  if (email == null || email == "null") {
    //create customer
    var id = createCustomer(dataIn);
    return id;
  } else {
    // continue
    filters.push(new nlobjSearchFilter("email", null, "is", email));
  }

  var customer = nlapiSearchRecord("customer", null, filters);

  if (customer && customer.length > 0) {
    //update customer
    nlapiLogExecution("Debug", customer[0].getId(), JSON.stringify(dataIn));
    var id = customer[0].getId();
    var customerRec = nlapiLoadRecord("customer", id);
    var lines = customerRec.getLineItemCount("addressbook");
    var flag = 0;
    if (lines > 0) {
      for (var k = 1; k <= lines; k++) {
        var custZip = customerRec.getLineItemValue(
          "addressbook",
          "zip_initialvalue",
          k
        );
        var custAddr1 = customerRec.getLineItemValue(
          "addressbook",
          "addr1_initialvalue",
          k
        );
        if (custZip == addr_info.postalCode && custAddr1 == addr_info.street1) {
          flag++;
        }
      }
    }

    if (flag == 0) {
      customerRec.selectNewLineItem("addressbook");
      customerRec.setCurrentLineItemValue(
        "addressbook",
        "label",
        addr_info.street1
      );

      var subRecord = customerRec.createCurrentLineItemSubrecord(
        "addressbook",
        "addressbookaddress"
      );
      subRecord.setFieldValue("country", addr_info.country);

      if (addr_info.street1 != "null" && addr_info.street1 != null) {
        subRecord.setFieldValue("addr1", addr_info.street1);
      } else {
        subRecord.setFieldValue("addr1", "");
      }

      if (addr_info.street2 != "null" && addr_info.street2 != null) {
        subRecord.setFieldValue("addr2", addr_info.street2);
      } else {
        subRecord.setFieldValue("addr2", "");
      }

      subRecord.setFieldValue("zip", addr_info.postalCode);
      subRecord.setFieldValue("state", addr_info.state);
      subRecord.setFieldValue("city", addr_info.city);

      subRecord.commit();
      customerRec.commitLineItem("addressbook");
    }

    var submitedId = nlapiSubmitRecord(customerRec);
    nlapiLogExecution(
      "debug",
      submitedId + " customer is updated",
      JSON.stringify(dataIn.shipTo)
    );
    return submitedId;
  } else {
    //create customer
    var id = createCustomer(dataIn);
    return id;
  }
}

function createCustomer(dataIn) {
  var newRecord = nlapiCreateRecord("customer");

  if (dataIn.email != null && dataIn.email != "null")
    newRecord.setFieldValue("email", dataIn.email);

  newRecord.setFieldValue("isperson", "T");

  if (
    dataIn.shipTo.name != null &&
    dataIn.shipTo.name != "null" &&
    dataIn.shipTo.name != "" &&
    dataIn.shipTo.name
  ) {
    var customerName = dataIn.shipTo.name.split(" ");
    var firstName = customerName[0];
    var lastName = customerName.slice(1, customerName.length).join(" ").trim();

    newRecord.setFieldValue("firstname", firstName.substr(0, 20));
    if (lastName && customerName.length > 1)
      newRecord.setFieldValue("lastname", lastName.substr(0, 20));
  } else {
    newRecord.setFieldValue("firstname", "firstname");
    newRecord.setFieldValue("lastname", "lastname");
  }

  if (dataIn.shipTo.phone != null && dataIn.shipTo.phone != "null")
    newRecord.setFieldValue("phone", dataIn.shipTo.phone);
  newRecord.setFieldValue("subsidiary", 1);
  newRecord.setFieldValue("custentitycsr", "shipstation");

  newRecord.selectNewLineItem("addressbook");
  newRecord.setCurrentLineItemValue(
    "addressbook",
    "label",
    dataIn.shipTo.street1
  );

  var subRecord = newRecord.createCurrentLineItemSubrecord(
    "addressbook",
    "addressbookaddress"
  );
  if (dataIn.shipTo.country) {
    subRecord.setFieldValue("country", dataIn.shipTo.country);
  } else {
    subRecord.setFieldValue("country", "US");
  }

  subRecord.setFieldValue("addressee", dataIn.shipTo.name);

  if (dataIn.shipTo.street1 != "null" && dataIn.shipTo.street1 != null) {
    subRecord.setFieldValue("addr1", dataIn.shipTo.street1);
  } else {
    subRecord.setFieldValue("addr1", "");
  }

  if (dataIn.shipTo.street2 != "null" && dataIn.shipTo.street2 != null) {
    subRecord.setFieldValue("addr2", dataIn.shipTo.street2);
  } else {
    subRecord.setFieldValue("addr2", "");
  }

  subRecord.setFieldValue("zip", dataIn.shipTo.postalCode);
  subRecord.setFieldValue("state", dataIn.shipTo.state);
  subRecord.setFieldValue("city", dataIn.shipTo.city);

  subRecord.commit();
  newRecord.commitLineItem("addressbook");
  var submitedId = nlapiSubmitRecord(newRecord);
  nlapiLogExecution(
    "debug",
    submitedId + " customer is created",
    JSON.stringify(dataIn.shipTo)
  );
  return submitedId;
}

function createSalesOrder(customerId, addressbookId, dataIn) {
  var salesOrder = nlapiCreateRecord("salesorder");

  salesOrder.setFieldValue("entity", customerId);
  salesOrder.setFieldValue("otherrefnum", dataIn.orderNumber);
  if (dataIn.orderDate)
    salesOrder.setFieldValue("trandate", dateFormat(dataIn.orderDate));
  else return null;
  salesOrder.setFieldValue("memo", "shipstation order");
  salesOrder.setFieldValue("orderstatus", "B");
  salesOrder.setFieldValue("custbody_shipstation_order_key", dataIn.orderKey);

  if (addressbookId != null) {
    salesOrder.setFieldValue("shipaddresslist", addressbookId);
  }

  salesOrder.setFieldValue("subsidiary", 1);

  var order = dataIn.items;

  var shipTotal = dataIn.shippingAmount;

  for (var i = 0; i < order.length; i++) {
    var orderObj = order[i];
    var sku = orderObj.sku;
    var itemId = searchItem(sku);

    if (itemId == null) return null;

    var itemCharge = orderObj.unitPrice;
    var amount = 0;
    var tax = 0;
    var quantity = 1;
    if (orderObj.quantity && orderObj.quantity > 0) {
      quantity = orderObj.quantity;
    }

    salesOrder.selectNewLineItem("item");
    salesOrder.setCurrentLineItemValue("item", "item", itemId);
    salesOrder.setCurrentLineItemValue("item", "price", -1);
    salesOrder.setCurrentLineItemValue("item", "rate", itemCharge);
    salesOrder.setCurrentLineItemValue("item", "currencyname", "USD");
    salesOrder.setCurrentLineItemValue("item", "quantity", quantity);
    salesOrder.commitLineItem("item");
  }

  salesOrder.setFieldValue("shippingcost", shipTotal);

  var submitted = nlapiSubmitRecord(salesOrder, false, true);
  return submitted;
}

function dateFormat(data) {
  var date = data.split("T");
  var dateArr = date[0].split("-");
  var month = Number(dateArr[2]);
  var dateStr = dateArr[1] + "/" + dateArr[2] + "/" + dateArr[0];

  return dateStr;
}

function searchItem(sku) {
  try {
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
      return itemid;
    } else {
      filter = [["itemid", "is", sku]];
      item = nlapiSearchRecord("inventoryitem", null, filter, null);
      if (item && item.length > 0) {
        return item[0].getId();
      }
    }
    return null;
  } catch (e) {
    nlapiLogExecution("Debug", "sku not found", sku);
  }
}

function check_customer_rec(customerId) {
  if (customerId) {
    var customer_data = nlapiLookupField("customer", customerId, [
      "custentity_sync_netsuite",
      "subsidiary",
    ]);
    if (
      customer_data.custentity_sync_netsuite != "T" ||
      customer_data.subsidiary != "1"
    )
      return false;
    return true;
  }
  return false;
}

function checkGovernance() {
  if (nlapiGetContext().getRemainingUsage() < 500) {
    nlapiLogExecution(
      "AUDIT",
      "checkGovernance---",
      nlapiGetContext().getRemainingUsage()
    );
    var state = nlapiYieldScript();
    _audit("state.status", state.status);
    if (state.status == "FAILURE") {
      throw nlapiCreateError(
        "YIELD_SCRIPT_ERROR",
        "Failed to yield script, exiting<br/>Reason = " +
          state.reason +
          "<br/>Size = " +
          state.size +
          "<br/>Information = " +
          state.information
      );
    } else if (state.status == "RESUME") {
      nlapiLogExecution(
        "debug",
        "checkGovernance-------------",
        nlapiGetContext().getRemainingUsage()
      );
      nlapiLogExecution(
        "AUDIT",
        "Resuming script because of " + state.reason + ".  Size = " + state.size
      );
    }
  } else {
    nlapiGetContext().setPercentComplete(
      (1e4 - nlapiGetContext().getRemainingUsage()) / 100
    );
  }
}
