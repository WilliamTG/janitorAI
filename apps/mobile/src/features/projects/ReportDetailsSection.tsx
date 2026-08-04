import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';

import {
  Body,
  Caption,
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  TextField,
  useAppTheme,
} from '@/src/ui';

import { ReportBuilding, ReportContributor, ReportMeta } from './types';

type Props = {
  meta: ReportMeta;
  onChange: (meta: ReportMeta) => void;
  onSave: () => void;
  isOpen: boolean;
  onToggle: () => void;
  saving?: boolean;
  saveError?: string | null;
};

export function ReportDetailsSection({ meta, onChange, onSave, isOpen, onToggle, saving, saveError }: Props) {
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
        <Body style={{ fontWeight: '600', fontSize: 17 }}>📋 Report details</Body>
        <Ionicons
          name={isOpen ? 'chevron-up-outline' : 'chevron-down-outline'}
          size={20}
          color={theme.colors.muted}
        />
      </TouchableOpacity>

      {!isOpen && (
        <Caption muted>
          Tap to fill in case info, inspector, buildings and contributors for the report.
        </Caption>
      )}

      {isOpen && (
        <View style={{ gap: theme.spacing.md }}>

          {/* ── Case info ── */}
          {sectionLabel('Case info')}
          {inputField('Case number', meta.caseNumber, v => setField('caseNumber', v))}
          {inputField('Working number', meta.workingNumber, v => setField('workingNumber', v))}
          {inputField('Damage date', meta.damageDate, v => setField('damageDate', v))}
          {inputField('Inspection date', meta.inspectionDate, v => setField('inspectionDate', v))}
          {inputField('Inspection object / room type', meta.pictureObject, v => setField('pictureObject', v))}

          {/* ── Inspector ── */}
          {sectionLabel('Inspector')}
          {inputField('Name', meta.inspectionDoneByName, v => setField('inspectionDoneByName', v))}
          {inputField('Phone', meta.inspectionDoneByPhone, v => setField('inspectionDoneByPhone', v))}
          {inputField('Company', meta.inspectionDoneByCompany, v => setField('inspectionDoneByCompany', v))}

          {/* ── Insurance ── */}
          {sectionLabel('Insurance')}
          {inputField('Insurance company', meta.insuranceCompany, v => setField('insuranceCompany', v))}
          {inputField('Claims handler', meta.insuranceAgent, v => setField('insuranceAgent', v))}

          {/* ── Customer ── */}
          {sectionLabel('Customer')}
          {inputField('Customer name', meta.customerName, v => setField('customerName', v))}
          {inputField('Street address', meta.addressStreet, v => setField('addressStreet', v))}
          {inputField('Postcode and city', meta.addressPostcodeCity, v => setField('addressPostcodeCity', v))}

          {/* ── Contributors ── */}
          {sectionLabel('Contributors')}
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
                <Caption style={{ fontWeight: '600' }}>Contributor {i + 1}</Caption>
                {contributors.length > 1 && (
                  <SecondaryButton onPress={() => removeContributor(i)} width={80}>
                    Remove
                  </SecondaryButton>
                )}
              </View>
              {inputField('Name', c.name, v => updateContributor(i, 'name', v))}
              {inputField('Role', c.role, v => updateContributor(i, 'role', v))}
              {inputField('Phone', c.phone, v => updateContributor(i, 'phone', v))}
              {inputField('Email (optional)', c.email, v => updateContributor(i, 'email', v))}
            </View>
          ))}
          <SecondaryButton onPress={addContributor}>+ Add contributor</SecondaryButton>

          {/* ── Buildings ── */}
          {sectionLabel('Buildings')}
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
                <Caption style={{ fontWeight: '600' }}>Building {i + 1}</Caption>
                {buildings.length > 1 && (
                  <SecondaryButton onPress={() => removeBuilding(i)} width={80}>
                    Remove
                  </SecondaryButton>
                )}
              </View>
              {inputField('Building type', b.type, v => updateBuilding(i, 'type', v))}
              {inputField('Size (m²)', b.size, v => updateBuilding(i, 'size', v))}
              {inputField('Year built', b.buildingYear, v => updateBuilding(i, 'buildingYear', v))}
              {inputField('Renovations done', b.renovationsDone, v => updateBuilding(i, 'renovationsDone', v), true)}
              {inputField('Other info', b.otherInfo, v => updateBuilding(i, 'otherInfo', v), true)}
              {inputField('Damaged area – description', b.damagedAreaDescription, v => updateBuilding(i, 'damagedAreaDescription', v), true)}
              {inputField('Damaged area – estimated value', b.damagedAreaEstimatedValue, v => updateBuilding(i, 'damagedAreaEstimatedValue', v))}
            </View>
          ))}
          <SecondaryButton onPress={addBuilding}>+ Add building</SecondaryButton>

          {/* ── Damage & status ── */}
          {sectionLabel('Damage & status')}
          {inputField('Possible recourse', meta.possibleRecourse, v => setField('possibleRecourse', v), true)}
          {inputField('Measures to prevent future damage', meta.measuresToPreventFutureDamage, v => setField('measuresToPreventFutureDamage', v), true)}
          {inputField('Started repairs', meta.startedRepairs, v => setField('startedRepairs', v), true)}
          {inputField('Value loss per month (NOK)', meta.habitableValueLossPerMonth, v => setField('habitableValueLossPerMonth', v))}
          {inputField('Habitable – other info', meta.habitableOtherInfo, v => setField('habitableOtherInfo', v), true)}
          {inputField('Summary', meta.summaryText, v => setField('summaryText', v), true)}

          {/* Save button */}
          {saveError ? (
            <Caption style={{ color: 'red', textAlign: 'center' }}>{saveError}</Caption>
          ) : null}
          <PrimaryButton onPress={onSave} loading={saving} disabled={saving}>
            Save report details
          </PrimaryButton>
        </View>
      )}
    </GlassCard>
  );
}
