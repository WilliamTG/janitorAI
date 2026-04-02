import time

def static_replacements(dummy_values=False):
    """
    Returnerer en dictionary med erstatninger for alle statiske felter i malen.
    Hvis dummy_values=True, fylles den med data for demo-formål (Sigurd/Ocab-case).
    """
    
    if dummy_values:
        return {
            # --- Informasjon om skaden ---
            "{{claim.case_number}}": "2026-99123-SK",
            "{{report.inspection.done_by.name}}":"William Grener",
            "{{report.inspection.done_by.phone}}":"99887766",
            "{{report.inspection.done_by.company}}":"JanitorAI",
            "{{report.working_number}}":"WN-2026-XYZ56",
            "{{report.created}}":time.strftime("%d.%m.%Y"),
            "{{report.picture.object}}": "Kjeller / Bod",
            "{{claim.insurance.company}}": "Tryg Forsikring",
            "{{claim.insurance.agent}}": "Jan Johansen",
            "{{claim.customer.name}}": "Sigurd Myklebust",
            "{{claim.address.street}}": "Kjellerveien 12",
            "{{claim.address.postcode_city}}": "0123 Oslo",
            "{{claim.damage_date}}": "28.03.2026",
            "{{claim.Inspection_date}}": time.strftime("%d.%m.%Y"),

            # --- Deltakere ---
            "{{report.contributor.1.name}}": "Sigurd Myklebust",
            "{{report.contributor.1.role}}": "Forsikringstaker",
            "{{report.contributor.1.phone}}": "40295320",
            "{{report.contributor.2.name}}": "William Grener",
            "{{report.contributor.2.role}}": "Takstkonsulent (JanitorAI)",
            "{{report.contributor.2.phone}}": "99887766",
            "{{report.contributor.2.email}}": "william@janitorai.no",

            # --- Bygningstype og info ---
            "{{bulding.0.type}}": "Enebolig",
            "{{bulding.0.size}}": "210",
            "{{bulding.0.bulding_year}}": "1984",
            "{{bulding.0.renovations_done}}": "Modernisert kjeller 2012",
            "{{bulding.0.other_info}}": "Bygget på Leca grunnmur, trebjelkelag.",
            "{{bulding.1.type}}": "-",
            "{{bulding.1.size}}": "-",
            "{{bulding.1.bulding_year}}": "-",
            "{{bulding.1.renovations_done}}": "-",
            "{{bulding.1.other_info}}": "-",

            # --- Løsøre ---
            "{{bulding.0.damaged_area.description}}": "Vaskemaskin og div. lagret utstyr i bod",
            "{{bulding.0.damaged_area.estimated_value}}": "15.000 NOK",
            "{{bulding.1.damaged_area.description}}": "-",
            "{{bulding.1.damaged_area.estimated_value}}": "-",

            # --- Diverse status-felter ---
            "{{damage.possible_recourse}}": "Ingen åpenbar regress mot tredjepart.",
            "{{damage.measures_to_prevenet_future_damage.description}}": "Sikre slemning av grunnmur og etablere bedre fall fra husvegg.",
            "{{damage.started_repairs}}": "Vannsuging utført, avfukter satt i drift.",
            "{{habitable.value_loss_per_month_nok}}": "0",
            "{{habitable.other_info}}": "Kjelleren kan ikke benyttes til opphold før tørking er ferdigstilt.",
            "{{summary.text}}": "Skaden skyldes akutt inntrengning av vann mot ubeskyttet grunnmur under ekstremnedbør. Omfanget er begrenset til kjellerbod og gang.",

            # --- Bilder og Planskisse ---
            "{{report.picture.floor_plan}}": "Se vedlagt planskisse", # Bildet settes inn av doc_engine
        }
    else:
        # Returner tomme verdier hvis ikke dummy (for produksjon)
        return {}