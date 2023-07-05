function sync(request, response) {
  var so_id = results[i].getId();
  var so_rec = nlapiLoadRecord("salesorder", so_id);
  var reason = "";

  reason = reason + "check_lineitem_count:";
  if (!check_lineitem_count(so_rec)) {
    reason = reason + "dropship";
    return null;
  }
  reason = reason + "NOTdropship:";
}

function check_lineitem_count(so_rec) {
  var count = so_rec.getLineItemCount("item");
  var ds_count = 0;
  for (var i = 1; i <= count; i++) {
    var createpo = so_rec.getLineItemValue("item", "createpo", i);
    var createpo_txt = so_rec.getLineItemText("item", "createpo", i);
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
