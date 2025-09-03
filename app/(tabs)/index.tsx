// TodoScreen.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as React from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';

// Habilitar LayoutAnimation en Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Task = {
  id: string;
  title: string;
  completed: boolean;
};

type Filter = 'all' | 'active' | 'completed';

const STORAGE_KEY = '@todo.tasks.v1';
const { height } = Dimensions.get('window');
export default function HomeScreen() {
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [text, setText] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingText, setEditingText] = React.useState('');

  // Cargar desde AsyncStorage al montar
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: Task[] = JSON.parse(raw);
          setTasks(parsed);
        }
      } catch (e) {
        console.warn('No se pudieron cargar tareas', e);
      }
    })();
  }, []);

  // Guardar automáticamente cada vez que cambian las tareas
  React.useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tasks)).catch(() => {});
  }, [tasks]);

  const addTask = React.useCallback(() => {
    const title = text.trim();
    if (!title) return; // no agregar vacías
    const newTask: Task = {
      id: (Date.now() + Math.random()).toString(), // key estable
      title,
      completed: false,
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks((prev) => [newTask, ...prev]);
    setText('');
  }, [text]);

  const toggleTask = React.useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)),
    );
  }, []);

  const deleteTask = React.useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirmDelete = React.useCallback((id: string, title: string) => {
    Alert.alert('Eliminar tarea', `¿Eliminar "${title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteTask(id) },
    ]);
  }, [deleteTask]);

  // Doble tap → edición inline
  const startEditing = React.useCallback((task: Task) => {
    setEditingId(task.id);
    setEditingText(task.title);
  }, []);

  const commitEditing = React.useCallback(() => {
    if (!editingId) return;
    const newTitle = editingText.trim();
    // si queda vacío, no guardamos cambios (restauramos original)
    if (!newTitle) {
      setEditingId(null);
      setEditingText('');
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === editingId ? { ...t, title: newTitle } : t)));
    setEditingId(null);
    setEditingText('');
  }, [editingId, editingText]);

  const cancelEditing = React.useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  const filteredTasks = React.useMemo(() => {
    switch (filter) {
      case 'active':
        return tasks.filter((t) => !t.completed);
      case 'completed':
        return tasks.filter((t) => t.completed);
      default:
        return tasks;
    }
  }, [tasks, filter]);

  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;

  const renderItem = React.useCallback(
    ({ item }: { item: Task }) => (
      <TaskRow
        task={item}
        isEditing={editingId === item.id}
        editingText={editingText}
        setEditingText={setEditingText}
        onToggle={() => toggleTask(item.id)}
        onLongPress={() => confirmDelete(item.id, item.title)}
        onDoubleTap={() => startEditing(item)}
        onSubmitEdit={commitEditing}
        onCancelEdit={cancelEditing}
      />
    ),
    [editingId, editingText, toggleTask, confirmDelete, startEditing, commitEditing, cancelEditing],
  );

  return (
    <View style={styles.container}>
      {/* Header: Input + Agregar */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Nueva tarea..."
          value={text}
          onChangeText={setText}
          onSubmitEditing={addTask}
          returnKeyType="done"
        />
        <Pressable onPress={addTask} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <Text style={styles.addBtnText}>Añadir</Text>
        </Pressable>
      </View>

      {/* Contadores */}
      <View style={styles.countersRow}>
        <Text style={styles.counterText}>Total: {total}</Text>
        <Text style={styles.counterText}>Completadas: {completed}</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filtersRow}>
        <FilterChip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
        <FilterChip label="Activas" active={filter === 'active'} onPress={() => setFilter('active')} />
        <FilterChip label="Completadas" active={filter === 'completed'} onPress={() => setFilter('completed')} />
      </View>

      {/* Lista */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>No hay tareas {filter === 'completed' ? 'completadas' : filter === 'active' ? 'activas' : ''}.</Text>
        }
        initialNumToRender={12}
        removeClippedSubviews
      />
    </View>
  );
}

/* ---------- Item de la lista (memo) ---------- */

const TaskRow = React.memo(function TaskRow({
  task,
  isEditing,
  editingText,
  setEditingText,
  onToggle,
  onLongPress,
  onDoubleTap,
  onSubmitEdit,
  onCancelEdit,
}: {
  task: Task;
  isEditing: boolean;
  editingText: string;
  setEditingText: (t: string) => void;
  onToggle: () => void;
  onLongPress: () => void;
  onDoubleTap: () => void;
  onSubmitEdit: () => void;
  onCancelEdit: () => void;
}) {
  // Detección simple de doble tap
  const lastTapRef = React.useRef(0);
  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 250) {
      onDoubleTap();
    } else {
      onToggle();
    }
    lastTapRef.current = now;
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [styles.itemRow, pressed && styles.pressed]}
    >
      {/* Checkbox simple */}
      <View style={[styles.checkbox, task.completed && styles.checkboxDone]} />
      {/* Título o editor inline */}
      {isEditing ? (
        <TextInput
          style={styles.itemInput}
          value={editingText}
          onChangeText={setEditingText}
          autoFocus
          onSubmitEditing={onSubmitEdit}
          onBlur={onSubmitEdit}
          blurOnSubmit
        />
      ) : (
        <Text style={[styles.itemText, task.completed && styles.itemTextDone]} numberOfLines={2}>
          {task.title}
        </Text>
      )}
    </Pressable>
  );
});

/* ---------- Chip de filtro ---------- */

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- Estilos ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.select({ ios: 56, android: 32 }),
    paddingHorizontal: 16,
    backgroundColor: '#101114',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop:  height * 0.05, 
    color: '#A3A3A3',
  },
  input: {
    flex: 1,
    backgroundColor: '#A5A8B0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#A3A3A3',
  },
  addBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700' },
  countersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop:  height * 0.05, 
  },
  counterText: { color: '#A3A3A3' },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop:  height * 0.05, 
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#1A1C20',
  },
  chipActive: {
    backgroundColor: '#4F46E5',
  },
  chipText: { color: '#A3A3A3', fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  listContent: {
    paddingVertical: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#15171B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#4F46E5',
  },
  checkboxDone: {
    backgroundColor: '#4F46E5',
  },
  itemText: {
    flex: 1,
    color: '#EDEDED',
    fontSize: 16,
  },
  itemTextDone: {
    color: '#9AA1AC',
    textDecorationLine: 'line-through',
  },
  itemInput: {
    flex: 1,
    color: '#fff',
    backgroundColor: '#1F2227',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 16,
  },
  empty: {
    textAlign: 'center',
    color: '#6B7280',
  }
});
