import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { isDevelopment } from '@/src/config/api';
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
          <Caption muted>Step {number}</Caption>
          <Title style={{ fontSize: 16 }}>{title}</Title>
        </View>
      </View>
      <Body muted>{description}</Body>
    </GlassCard>
  );
};

export default function GuideScreen() {
  const theme = useAppTheme();
  const router = useRouter();

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
      Alert.alert('Saved', 'Your profile has been saved. New projects will be pre-filled with these details.');
    } catch {
      Alert.alert('Error', 'Could not save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        {/* Header */}
        <View style={{ gap: theme.spacing.xs }}>
          <Caption muted>How it works</Caption>
          <Title>Inspection Guide</Title>
          <Body muted>
            JanitorAI turns your field observations into professional reports in minutes.
          </Body>
        </View>

        {/* My Profile */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="person-circle-outline" size={22} color={theme.colors.accent} />
            <Title style={{ fontSize: 16 }}>My profile</Title>
          </View>
          <Body muted>
            Save your details once — they'll pre-fill the inspector block whenever you create a new project.
          </Body>
          <TextField
            label="Full name"
            value={profile.name}
            onChangeText={(text) => setProfile((p) => ({ ...p, name: text }))}
            placeholder="Jane Smith"
          />
          <TextField
            label="Phone"
            value={profile.phone}
            onChangeText={(text) => setProfile((p) => ({ ...p, phone: text }))}
            placeholder="+1 555 000 1234"
            keyboardType="phone-pad"
          />
          <TextField
            label="Company"
            value={profile.company}
            onChangeText={(text) => setProfile((p) => ({ ...p, company: text }))}
            placeholder="Acme Inspections"
          />
          <SecondaryButton onPress={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save profile'}
          </SecondaryButton>
        </GlassCard>

        {/* Steps */}
        <Step
          number="1"
          title="Create a project"
          description="Tap 'New project' on the home screen and fill in the project name, inspection date, and your name."
          icon="folder-open-outline"
        />
        <Step
          number="2"
          title="Collect observations"
          description="Open the project and add notes as you walk the site. Type observations, record voice memos, snap photos, or attach short video clips."
          icon="create-outline"
        />
        <Step
          number="3"
          title="Enrich with AI"
          description="Tap 'Auto-describe' on any photo for an instant AI description. Tap 'Transcribe' on any voice note to convert speech to text automatically."
          icon="sparkles-outline"
        />
        <Step
          number="4"
          title="Generate the report"
          description="Switch to the Report tab inside a project and tap 'Create report'. The AI analyses all your notes, photos, and transcriptions to produce a structured inspection report."
          icon="document-text-outline"
        />
        <Step
          number="5"
          title="Export and share"
          description="Tap 'Export DOCX' to download a Word document you can share directly with your client."
          icon="share-outline"
        />

        {/* Tips */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="information-circle-outline" size={22} color={theme.colors.accent} />
            <Title style={{ fontSize: 16 }}>Tips for best results</Title>
          </View>
          <View style={{ gap: theme.spacing.xs }}>
            <Body muted>• Keep photos under 8 MB — the app warns you if they're too large.</Body>
            <Body muted>• Video clips must be 2 minutes or shorter for reliable uploads.</Body>
            <Body muted>• Add a project description so the AI focuses on the right areas.</Body>
            <Body muted>• Transcribe voice notes before generating the report.</Body>
          </View>
        </GlassCard>

        {/* Access */}
        <GlassCard style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <Ionicons name="key-outline" size={22} color={theme.colors.accent} />
            <Title style={{ fontSize: 16 }}>Access</Title>
          </View>
          <Body muted>
            An access token is required to use AI features. Enter it by tapping the key icon on the home screen.
          </Body>
        </GlassCard>

        {/* Dev debug link */}
        {isDevelopment() && (
          <SecondaryButton onPress={() => router.push('/debug' as any)}>
            🛠️ Debug Info
          </SecondaryButton>
        )}
      </View>
    </Screen>
  );
}
