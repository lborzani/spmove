import React, { useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { theme } from '@/constants/theme';
import { IcoThumbUp, IcoThumbDown, IcoPlus } from './Icons';
import {
  fetchReports,
  createReport,
  voteReport,
  type UserReport,
  type ReportCategory,
} from '@/services/reports';
import { getDeviceId } from '@/services/deviceId';

const CATEGORY_CONFIG: Record<ReportCategory, { label: string; color: string }> = {
  atraso: { label: 'Atraso', color: '#f59e0b' },
  superlotacao: { label: 'Superlotação', color: '#3b82f6' },
  acidente: { label: 'Acidente', color: '#ef4444' },
  outro: { label: 'Outro', color: '#8b5cf6' },
};

const CATEGORIES = Object.keys(CATEGORY_CONFIG) as ReportCategory[];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  return `há ${hrs}h`;
}

interface ReportCardProps {
  report: UserReport;
  onVote: (id: number, vote: 1 | -1) => void;
}

function ReportCard({ report, onVote }: ReportCardProps) {
  const cfg = CATEGORY_CONFIG[report.category];
  const isPromoted = report.promoted === 1;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.catBadge,
            { backgroundColor: `${cfg.color}22`, borderColor: `${cfg.color}55` },
          ]}>
          <Text style={[styles.catLabel, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        {report.station && <Text style={styles.stationTag}>{report.station}</Text>}
        {isPromoted && (
          <View style={styles.confirmedBadge}>
            <Text style={styles.confirmedText}>CONFIRMADO</Text>
          </View>
        )}
        <Text style={styles.timeText}>{timeAgo(report.created_at)}</Text>
      </View>

      {report.description ? <Text style={styles.cardDesc}>{report.description}</Text> : null}

      <View style={styles.voteRow}>
        <Pressable
          onPress={() => onVote(report.id, 1)}
          style={[styles.voteBtn, report.my_vote === 1 && styles.voteBtnActive]}>
          <IcoThumbUp
            size={14}
            color={report.my_vote === 1 ? theme.accent : theme.textDim}
            strokeWidth={2}
          />
          <Text style={[styles.voteCount, report.my_vote === 1 && { color: theme.accent }]}>
            {Math.max(0, report.net_votes)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onVote(report.id, -1)}
          style={[styles.voteBtn, report.my_vote === -1 && styles.voteBtnActive]}>
          <IcoThumbDown
            size={14}
            color={report.my_vote === -1 ? '#ef4444' : theme.textDim}
            strokeWidth={2}
          />
        </Pressable>
      </View>
    </View>
  );
}

interface CreateSheetProps {
  lineNum: string;
  stations: string[];
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onCreated: (report: UserReport) => void;
}

function CreateSheet({ lineNum, stations, sheetRef, onCreated }: CreateSheetProps) {
  const [category, setCategory] = useState<ReportCategory>('atraso');
  const [station, setStation] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const snapPoints = useMemo(() => ['75%'], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  const dismiss = useCallback(() => sheetRef.current?.dismiss(), [sheetRef]);

  const handleSubmit = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const report = await createReport({
        deviceId,
        lineNum,
        category,
        station: station ?? undefined,
        description: description.trim() || undefined,
      });
      onCreated(report);
      setDescription('');
      setCategory('atraso');
      setStation(null);
      dismiss();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'rate_limited') {
        Alert.alert('Limite atingido', 'Você já reportou nesta linha nos últimos 30 minutos.');
      } else {
        Alert.alert('Erro', 'Não foi possível enviar o relato. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }, [lineNum, category, station, description, onCreated, dismiss]);

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.bg }}
      handleIndicatorStyle={{ backgroundColor: theme.border }}>
      <BottomSheetScrollView
        contentContainerStyle={styles.sheetContent}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.modalTitle}>Reportar ocorrência</Text>
        <Text style={styles.modalSubtitle}>CATEGORIA</Text>
        <View style={styles.catChips}>
          {CATEGORIES.map((cat) => {
            const cfg = CATEGORY_CONFIG[cat];
            const active = category === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.catChip,
                  { borderColor: active ? cfg.color : theme.border },
                  active && { backgroundColor: `${cfg.color}22` },
                ]}>
                <Text style={[styles.catChipText, { color: active ? cfg.color : theme.textDim }]}>
                  {cfg.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {stations.length > 0 && (
          <>
            <Text style={styles.modalSubtitle}>ESTAÇÃO (opcional)</Text>
            <View style={styles.stationChips}>
              <Pressable
                onPress={() => setStation(null)}
                style={[styles.stationChip, !station && styles.stationChipActive]}>
                <Text style={[styles.stationChipText, !station && styles.stationChipTextActive]}>
                  Geral
                </Text>
              </Pressable>
              {stations.map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setStation(s)}
                  style={[styles.stationChip, station === s && styles.stationChipActive]}>
                  <Text
                    style={[styles.stationChipText, station === s && styles.stationChipTextActive]}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <Text style={styles.modalSubtitle}>DESCRIÇÃO (opcional)</Text>
        <BottomSheetTextInput
          style={styles.textInput}
          placeholder="O que está acontecendo?"
          placeholderTextColor={theme.textFaint}
          value={description}
          onChangeText={setDescription}
          maxLength={280}
          multiline
          numberOfLines={3}
        />

        <View style={styles.modalActions}>
          <Pressable
            onPress={handleSubmit}
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.submitText}>Enviar</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

interface Props {
  lineNum: string;
  stations?: string[];
}

export function UserReports({ lineNum, stations = [] }: Props) {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('');
  const sheetRef = useRef<BottomSheetModal>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = await getDeviceId();
      if (!cancelled) setDeviceId(id);
      try {
        const data = await fetchReports(lineNum, id);
        if (!cancelled) setReports(data);
      } catch {
        // silently ignore — reports are supplementary
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lineNum]);

  const sortReports = useCallback(
    (list: UserReport[]) =>
      [...list].sort(
        (a, b) =>
          b.promoted - a.promoted || b.net_votes - a.net_votes || b.created_at - a.created_at,
      ),
    [],
  );

  const handleVote = useCallback(
    async (id: number, vote: 1 | -1) => {
      if (!deviceId) return;
      try {
        const { netVotes, promoted } = await voteReport(id, vote, deviceId);
        setReports((prev) =>
          sortReports(
            prev.map((r) => {
              if (r.id !== id) return r;
              const newMyVote = r.my_vote === vote ? null : vote;
              return { ...r, net_votes: netVotes, promoted: promoted ? 1 : 0, my_vote: newMyVote };
            }),
          ),
        );
      } catch {
        // ignore
      }
    },
    [deviceId, sortReports],
  );

  const handleCreated = useCallback(
    (report: UserReport) => {
      setReports((prev) => sortReports([...prev, { ...report, my_vote: null }]));
    },
    [sortReports],
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>RELATOS DE USUÁRIOS</Text>
        <Pressable onPress={() => sheetRef.current?.present()} style={styles.addBtn}>
          <IcoPlus size={14} color={theme.accent} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Reportar</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={theme.accent} style={{ marginTop: 8 }} />
      ) : reports.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum relato ativo nesta linha.</Text>
      ) : (
        <View style={styles.list}>
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} onVote={handleVote} />
          ))}
        </View>
      )}

      <CreateSheet
        lineNum={lineNum}
        stations={stations}
        sheetRef={sheetRef}
        onCreated={handleCreated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    color: theme.textDim,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${theme.accent}66`,
    backgroundColor: `${theme.accent}11`,
  },
  addBtnText: { color: theme.accent, fontSize: 12, fontWeight: '600' },

  list: { gap: 8 },
  emptyText: { color: theme.textFaint, fontSize: 12 },

  card: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    padding: 12,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  catLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: `${theme.accent}22`,
    borderWidth: 1,
    borderColor: `${theme.accent}55`,
  },
  confirmedText: { fontSize: 9, fontWeight: '700', color: theme.accent, letterSpacing: 0.5 },
  timeText: { color: theme.textFaint, fontSize: 11, marginLeft: 'auto' },
  cardDesc: { color: theme.text, fontSize: 13, lineHeight: 18 },
  voteRow: { flexDirection: 'row', gap: 8 },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  voteBtnActive: { borderColor: theme.accent, backgroundColor: `${theme.accent}11` },
  voteCount: { color: theme.textDim, fontSize: 12, fontWeight: '600' },

  sheetContent: { paddingHorizontal: 20, paddingBottom: 36, gap: 12 },
  modalTitle: { color: theme.text, fontSize: 16, fontWeight: '700' },
  modalSubtitle: {
    color: theme.textDim,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  stationTag: {
    color: theme.textDim,
    fontSize: 10,
    fontWeight: '500',
    backgroundColor: theme.bg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: theme.border,
  },
  stationChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stationChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: 'transparent',
  },
  stationChipActive: {
    borderColor: theme.accent,
    backgroundColor: `${theme.accent}18`,
  },
  stationChipText: { color: theme.textDim, fontSize: 11, fontWeight: '500' },
  stationChipTextActive: { color: theme.accent, fontWeight: '700' },

  catChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  catChipText: { fontSize: 12, fontWeight: '600' },
  textInput: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.radiusCard,
    padding: 12,
    color: theme.text,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  submitBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  submitText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
