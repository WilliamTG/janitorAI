import time


def build_replacements(report_meta: dict) -> dict:
    """
    Builds the Google Doc template replacement dictionary from project metadata.

    report_meta is a dict matching the mobile app's ReportMeta shape:
      caseNumber, workingNumber, inspectionDoneByName, inspectionDoneByPhone,
      inspectionDoneByCompany, pictureObject, insuranceCompany, insuranceAgent,
      customerName, addressStreet, addressPostcodeCity, damageDate, inspectionDate,
      contributors: [{name, role, phone, email?}, ...],
      buildings: [{type, size, buildingYear, renovationsDone, otherInfo,
                   damagedAreaDescription, damagedAreaEstimatedValue}, ...],
      possibleRecourse, measuresToPreventFutureDamage, startedRepairs,
      habitableValueLossPerMonth, habitableOtherInfo, summaryText
    """

    def v(key, default="-"):
        val = report_meta.get(key)
        if val is None or str(val).strip() == "":
            return default
        return str(val).strip()

    result = {
        "{{claim.case_number}}": v("caseNumber"),
        "{{report.inspection.done_by.name}}": v("inspectionDoneByName"),
        "{{report.inspection.done_by.phone}}": v("inspectionDoneByPhone"),
        "{{report.inspection.done_by.company}}": v("inspectionDoneByCompany"),
        "{{report.working_number}}": v("workingNumber"),
        "{{report.created}}": time.strftime("%d.%m.%Y"),
        "{{report.picture.object}}": v("pictureObject"),
        "{{claim.insurance.company}}": v("insuranceCompany"),
        "{{claim.insurance.agent}}": v("insuranceAgent"),
        "{{claim.customer.name}}": v("customerName"),
        "{{claim.address.street}}": v("addressStreet"),
        "{{claim.address.postcode_city}}": v("addressPostcodeCity"),
        "{{claim.damage_date}}": v("damageDate"),
        "{{claim.Inspection_date}}": v("inspectionDate", time.strftime("%d.%m.%Y")),
        "{{damage.possible_recourse}}": v("possibleRecourse"),
        "{{damage.measures_to_prevenet_future_damage.description}}": v("measuresToPreventFutureDamage"),
        "{{damage.started_repairs}}": v("startedRepairs"),
        "{{habitable.value_loss_per_month_nok}}": v("habitableValueLossPerMonth", "0"),
        "{{habitable.other_info}}": v("habitableOtherInfo"),
        "{{summary.text}}": v("summaryText"),
        # Floor plan placeholder — image is inserted by doc_engine
        "{{report.picture.floor_plan}}": "Se vedlagt planskisse",
    }

    # Contributors — 1-indexed: report.contributor.1.*, report.contributor.2.*, …
    # Always emit at least 2 slots so every placeholder in the master template is replaced.
    contributors = list(report_meta.get("contributors") or [{}])
    while len(contributors) < 2:
        contributors.append({})
    for i, c in enumerate(contributors, 1):
        prefix = "{{report.contributor." + str(i) + "."
        result[prefix + "name}}"] = str(c.get("name") or "-").strip() or "-"
        result[prefix + "role}}"] = str(c.get("role") or "-").strip() or "-"
        result[prefix + "phone}}"] = str(c.get("phone") or "-").strip() or "-"
        # Always emit email key so template placeholder is replaced (avoids leaked {{...}} in doc)
        email = c.get("email")
        result[prefix + "email}}"] = str(email).strip() if (email and str(email).strip()) else "-"

    # Buildings — 0-indexed: bulding.0.*, bulding.1.*, …  (note: typo in template is intentional)
    # Always emit at least 2 slots so every placeholder in the master template is replaced.
    buildings = list(report_meta.get("buildings") or [{}])
    while len(buildings) < 2:
        buildings.append({})
    for i, b in enumerate(buildings):
        prefix = "{{bulding." + str(i) + "."
        result[prefix + "type}}"] = str(b.get("type") or "-").strip() or "-"
        result[prefix + "size}}"] = str(b.get("size") or "-").strip() or "-"
        result[prefix + "bulding_year}}"] = str(b.get("buildingYear") or "-").strip() or "-"
        result[prefix + "renovations_done}}"] = str(b.get("renovationsDone") or "-").strip() or "-"
        result[prefix + "other_info}}"] = str(b.get("otherInfo") or "-").strip() or "-"
        result[prefix + "damaged_area.description}}"] = str(b.get("damagedAreaDescription") or "-").strip() or "-"
        result[prefix + "damaged_area.estimated_value}}"] = str(b.get("damagedAreaEstimatedValue") or "-").strip() or "-"

    return result
