import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import { nb } from '@/src/i18n/nb';
import {
  Body,
  Caption,
  GlassCard,
  SecondaryButton,
  TextField,
  useAppTheme,
} from '@/src/ui';

import { ReportBuilding, ReportContributor, ReportMeta } from './types';

type Props = {
  meta: ReportMeta;
  onChange: (meta: ReportMeta) => void;
  isOpen: boolean;
  onToggle: () => void;
  saveStatus?: 'idle' | 'saving' | 'saved';
  saveError?: string | null;
};

export function ReportDetailsSection({ meta, onChange, isOpen, onToggle, saveStatus, saveError }: Props) {
  const theme = useAppTheme();

  // ----- helpers -----

  const setField = <K extends keyof ReportMeta>(key: K, value: ReportMeta[K]) =>
    onChange({ ...meta, [key]: value });

  const contributors: ReportContributor[] = meta.contributors?.length
    ? meta.contributors
    : [{}];

  const buildings: ReportBuilding[] = meta.buildings?.length
    ? meta.buildings
    : [{}];

  const updateContributor = (i: number, field: keyof ReportContributor, value: string) => {
    const next = [...contributors];
    next[i] = { ...next[i], [field]: value };
    setField('contributors', next);
  };

  const addContributor = () => setField('contributors', [...contributors, {}]);
  const removeContributor = (i: number) =>
    setField('contributors', contributors.filter((_, idx) => idx !== i));

  const updateBuilding = (i: number, field: keyof ReportBuilding, value: string) => {
    const next = [...buildings];
    next[i] = { ...next[i], [field]: value };
    setField('buildings', next);
  };

  const addBuilding = () => setField('buildings', [...buildings, {}]);
  const removeBuilding = (i: number) =>
    setField('buildings', buildings.filter((_, idx) => idx !== i));

  // ----- render helpers -----

  const inputField = (
    label: string,
    value: string | undefined,
    onChangeText: (v: string) => void,
    multiline = false,
  ) => (
    <View style={{ gap: 4 }}>
      <Caption muted>{label}</Caption>
      <TextField
        value={value ?? ''}
        onChangeText={onChangeText}
        placeholder="–"
        multiline={multiline}
        style={multiline ? { minHeight: 64, textAlignVertical: 'top' } : undefined}
      />
    </View>
  );

  const sectionLabel = (title: string) => (
    <Body style={{ fontWeight: '600', marginTop: theme.spacing.xs }}>{title}</Body>
  );

  // ----- component -----

  return (
    <GlassCard style={{ gap: theme.spacing.sm }}>
      {/* Collapsible header */}
      <TouchableOpacity
        onPress={onToggle}
        activeOpacity={0.7}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Ionicons name="clipboard-outline" size={18} color={theme.colors.accent} />
          <Body style={{ fontWeight: '600', fontSize: 17 }}>{nb.report.details}</Body>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={20}
          color={theme.colors.muted}
        />
      </TouchableOpacity>

      {!isOpen && (
        <Caption muted>
          Trykk for å fylle inn saksinfo, takstperson, bygninger og medvirkende til rapporten.
        </Caption>
      )}

      {isOpen && (
        <View style={{ gap: theme.spacing.md }}>

          {/* ── Saksinfo ── */}
          {sectionLabel('Saksinfo')}
          {inputField('Saksnummer', meta.caseNumber, v => setField('caseNumber', v))}
          {inputField('Arbeidsnummer', meta.workingNumber, v => setField('workingNumber', v))}
          {inputField('Skadedato', meta.damageDate, v => setField('damageDate', v))}
          {inputField('Befaringsdato', meta.inspectionDate, v => setField('inspectionDate', v))}
          {inputField('Befaringsobjekt / romtype', meta.pictureObject, v => setField('pictureObject', v))}

          {/* ── Takstperson ── */}
          {sectionLabel(nb.projects.inspectorLabel)}
          {inputField(nb.guide.nameLabel, meta.inspectionDoneByName, v => setField('inspectionDoneByName', v))}
          {inputField(nb.guide.phoneLabel, meta.inspectionDoneByPhone, v => setField('inspectionDoneByPhone', v))}
          {inputField(nb.guide.companyLabel, meta.inspectionDoneByCompany, v => setField('inspectionDoneByCompany', v))}

          {/* ── Forsikring ── */}
          {sectionLabel('Forsikring')}
          {inputField('Forsikringsselskap', meta.insuranceCompany, v => setField('insuranceCompany', v))}
          {inputField('Skadebehandler', meta.insuranceAgent, v => setField('insuranceAgent', v))}

          {/* ── Kunde ── */}
          {sectionLabel('Kunde')}
          {inputField('Kundenavn', meta.customerName, v => setField('customerName', v))}
          {inputField('Gateadresse', meta.addressStreet, v => setField('addressStreet', v))}
          {inputField('Postnummer og sted', meta.addressPostcodeCity, v => setField('addressPostcodeCity', v))}

          {/* ── Medvirkende ── */}
          {sectionLabel('Medvirkende')}
          {contributors.map((c, i) => (
            <View
              key={i}
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surfaceSecondary,
                borderRadius: theme.radii.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Caption style={{ fontWeight: '600' }}>Medvirkende {i + 1}</Caption>
                {contributors.length > 1 && (
                  <SecondaryButton onPress={() => removeContributor(i)} width={80}>
                    Fjern
                  </SecondaryButton>
                )}
              </View>
              {inputField(nb.guide.nameLabel, c.name, v => updateContributor(i, 'name', v))}
              {inputField('Rolle', c.role, v => updateContributor(i, 'role', v))}
              {inputField(nb.guide.phoneLabel, c.phone, v => updateContributor(i, 'phone', v))}
              {inputField('E-post (valgfritt)', c.email, v => updateContributor(i, 'email', v))}
            </View>
          ))}
          <SecondaryButton onPress={addContributor}>Legg til medvirkende</SecondaryButton>

          {/* ── Bygninger ── */}
          {sectionLabel('Bygninger')}
          {buildings.map((b, i) => (
            <View
              key={i}
              style={{
                gap: theme.spacing.sm,
                padding: theme.spacing.sm,
                backgroundColor: theme.colors.surfaceSecondary,
                borderRadius: theme.radii.md,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Caption style={{ fontWeight: '600' }}>Bygning {i + 1}</Caption>
                {buildings.length > 1 && (
                  <SecondaryButton onPress={() => removeBuilding(i)} width={80}>
                    Fjern
                  </SecondaryButton>
                )}
              </View>
              {inputField('Bygningstype', b.type, v => updateBuilding(i, 'type', v))}
              {inputField('Areal (m²)', b.size, v => updateBuilding(i, 'size', v))}
              {inputField('Byggeår', b.buildingYear, v => updateBuilding(i, 'buildingYear', v))}
              {inputField('Utførte oppgraderinger', b.renovationsDone, v => updateBuilding(i, 'renovationsDone', v), true)}
              {inputField('Annen informasjon', b.otherInfo, v => updateBuilding(i, 'otherInfo', v), true)}
              {inputField('Skadet område – beskrivelse', b.damagedAreaDescription, v => updateBuilding(i, 'damagedAreaDescription', v), true)}
              {inputField('Skadet område – anslått verdi', b.damagedAreaEstimatedValue, v => updateBuilding(i, 'damagedAreaEstimatedValue', v))}
            </View>
          ))}
          <SecondaryButton onPress={addBuilding}>Legg til bygning</SecondaryButton>

          {/* ── Skade og status ── */}
          {sectionLabel('Skade og status')}
          {inputField('Mulig regress', meta.possibleRecourse, v => setField('possibleRecourse', v), true)}
          {inputField('Tiltak for å hindre fremtidig skade', meta.measuresToPreventFutureDamage, v => setField('measuresToPreventFutureDamage', v), true)}
          {inputField('Påbegynte utbedringer', meta.startedRepairs, v => setField('startedRepairs', v), true)}
          {inputField('Verditap per måned (kr)', meta.habitableValueLossPerMonth, v => setField('habitableValueLossPerMonth', v))}
          {inputField('Beboelighet – annen info', meta.habitableOtherInfo, v => setField('habitableOtherInfo', v), true)}
          {inputField('Sammendrag', meta.summaryText, v => setField('summaryText', v), true)}

          {/* Pilotfunn (aug 2026): lagre-knappen ble glemt — feltene autolagres. */}
          {saveError ? (
            <Caption style={{ color: theme.colors.danger, textAlign: 'center' }}>{saveError}</Caption>
          ) : (
            <Caption muted style={{ textAlign: 'center' }}>
              {saveStatus === 'saving'
                ? 'Lagrer …'
                : saveStatus === 'saved'
                  ? 'Lagret ✓ — feltene lagres automatisk mens du skriver'
                  : 'Feltene lagres automatisk mens du skriver'}
            </Caption>
          )}
        </View>
      )}
    </GlassCard>
  );
}
