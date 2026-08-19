import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { View } from 'react-native';

import { isDevelopment } from '@/src/config/api';
import { nb } from '@/src/i18n/nb';
import { loadProfile, saveProfile, InspectorProfile } from '@/src/storage/profileStorage';
import {
  Body,
  Caption,
  GlassCard,
  Screen,
  SecondaryButton,
  TextField,
  Title,
  useAppTheme,
  useToast,
} from '@/src/ui';

type StepProps = {
  number: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
};

const Step = ({ number, title, description, icon }: StepProps) => {
  const theme = useAppTheme();
  return (
    <GlassCard style={{ gap: theme.spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Caption muted>{`Steg ${number}`}</Caption>
          <Title style={{ fontSize: 16 }}>{title}</Title>
        </View>
      </View>
      <Body muted>{description}</Body>
    </GlassCard>
  );
};

const TipRow = ({ text }: { text: string }) => {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
      <View style={{ paddingTop: 7 }}>
        <Ionicons name="ellipse" size={6} color={theme.colors.muted} />
      </View>
      <Body muted style={{ flex: 1 }}>
        {text}
      </Body>
    </View>
  );
};

export default function GuideScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const toast = useToast();

  const [profile, setProfile] = useState<InspectorProfile>({ name: '', phone: '', company: '' });
  const [isSaving, setIsSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile().then(setProfile);
    }, [])
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveProfile(profile);
      toast.show({
        message: 'Profilen ble lagret. Nye prosjekter fylles ut med disse opplysningene.',
        variant: 'success',
      });
    } catch {
      toast.show({ message: 'Kunne ikke lagre profilen. Prøv igjen.', variant: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        {/* Header */}
        <View style={{ gap: theme.spacing.xs }}>
          <Caption muted>{nb.tabs.guide}</Caption>
          <Title>{nb.guide.title}</Title>
          <Body muted>
            DocrAI gjør observasjonene dine fra befaringen om til profesjonelle rapporter på få
            minutter.
          </Body>
        </View>

        {/* Takstpersonprofil */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="person-circle-outline" size={22} color={theme.colors.accent} />
            <Title style={{ fontSize: 16 }}>{nb.guide.profileTitle}</Title>
          </View>
          <Body muted>
            Lagre opplysningene dine én gang — de fyller ut takstperson-feltene automatisk når du
            oppretter et nytt prosjekt.
          </Body>
          <TextField
            label={nb.guide.nameLabel}
            value={profile.name}
            onChangeText={(text) => setProfile((p) => ({ ...p, name: text }))}
            placeholder="Kari Nordmann"
          />
          <TextField
            label={nb.guide.phoneLabel}
            value={profile.phone}
            onChangeText={(text) => setProfile((p) => ({ ...p, phone: text }))}
            placeholder="+47 900 00 000"
            keyboardType="phone-pad"
          />
          <TextField
            label={nb.guide.companyLabel}
            value={profile.company}
            onChangeText={(text) => setProfile((p) => ({ ...p, company: text }))}
            placeholder="Takst AS"
          />
          <SecondaryButton onPress={handleSave} disabled={isSaving}>
            {isSaving ? 'Lagrer …' : 'Lagre profil'}
          </SecondaryButton>
        </GlassCard>

        {/* Steg */}
        <Step
          number="1"
          title="Opprett et prosjekt"
          description="Trykk «Nytt prosjekt» på startsiden og fyll inn prosjektnavn, befaringsdato og navnet ditt."
          icon="folder-open-outline"
        />
        <Step
          number="2"
          title="Samle observasjoner"
          description="Åpne prosjektet og legg til notater mens du går befaringen. Skriv observasjoner, ta opp lydnotater, ta bilder eller legg ved korte videoklipp."
          icon="create-outline"
        />
        <Step
          number="3"
          title="Berik med KI"
          description="Trykk «Beskriv automatisk» på et bilde for en umiddelbar KI-beskrivelse. Trykk «Transkriber» på et lydnotat for å gjøre tale om til tekst automatisk."
          icon="sparkles-outline"
        />
        <Step
          number="4"
          title="Lag rapporten"
          description="Gå til Rapport-fanen i prosjektet og trykk «Lag rapport». KI-en analyserer notatene, bildene og transkripsjonene dine og lager en strukturert befaringsrapport."
          icon="document-text-outline"
        />
        <Step
          number="5"
          title="Eksporter og del"
          description="Trykk «Last ned Word» for å laste ned et Word-dokument du kan dele direkte med kunden."
          icon="share-outline"
        />

        {/* Tips */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.accent} />
            <Title style={{ fontSize: 16 }}>Tips for best resultat</Title>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <TipRow text="Hold bilder og videoer under 50 MB — appen varsler deg hvis de er for store." />
            <TipRow text="Videoklipp må være 2 minutter eller kortere for pålitelig opplasting." />
            <TipRow text="Legg til en prosjektbeskrivelse så KI-en fokuserer på de riktige områdene." />
            <TipRow text="Transkriber lydnotatene før du lager rapporten." />
          </View>
        </GlassCard>

        {/* Tilgang */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="key-outline" size={22} color={theme.colors.accent} />
            <Title style={{ fontSize: 16 }}>{nb.auth.accessTitle}</Title>
          </View>
          <Body muted>
            Du trenger en tilgangskode for å bruke KI-funksjonene. Skriv den inn ved å trykke på
            nøkkelikonet på startsiden.
          </Body>
        </GlassCard>

        {/* Dev debug link */}
        {isDevelopment() && (
          <SecondaryButton onPress={() => router.push('/debug' as any)}>
            Feilsøkingsinfo
          </SecondaryButton>
        )}
      </View>
    </Screen>
  );
}
