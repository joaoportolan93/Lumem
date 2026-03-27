import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lumem/models/user.dart';
import 'package:lumem/services/settings_service.dart';
import 'package:lumem/services/auth_service.dart';
import 'package:lumem/services/user_service.dart';
import 'package:lumem/providers/settings_provider.dart';
import 'package:lumem/providers/alarm_provider.dart';
import 'package:lumem/models/alarm_model.dart';
import 'package:file_picker/file_picker.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  _SettingsScreenState createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final SettingsService _settingsService = SettingsService();
  final AuthService _authService = AuthService();
  final UserService _userService = UserService();

  bool _isLoading = true;
  bool _saving = false;
  Map<String, dynamic> _settings = {};

  User? _currentUser;
  bool _isPrivateLocal = false;

  List<User> _closeFriends = [];
  bool _loadingFriends = false;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 1 && _closeFriends.isEmpty) {
        _loadCloseFriends();
      }
      setState(() {});
    });
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final user = await _authService.getProfile();
    final settings = await _settingsService.getUserSettings();
    setState(() {
      _currentUser = user;
      _isPrivateLocal = user.isPrivate;
      _settings = settings ?? {
        'notificacoes_novas_publicacoes': true,
        'notificacoes_comentarios': true,
        'notificacoes_seguidor_novo': true,
        'notificacoes_reacoes': true,
        'notificacoes_mensagens_diretas': true,
        'tema_interface': 2,
        'idioma': 'pt-BR',
        'mostrar_feed_algoritmico': true,
      };
      _isLoading = false;
    });
  }

  Future<void> _loadCloseFriends() async {
    setState(() => _loadingFriends = true);
    final friends = await _settingsService.getCloseFriendsManage();
    setState(() {
      _closeFriends = friends;
      _loadingFriends = false;
    });
  }

  Future<void> _saveSettings() async {
    setState(() => _saving = true);
    final success = await _settingsService.updateUserSettings(_settings);
    // Notice: We don't dynamically update theme immediately in Flutter here unless we use a state management provider for ThemeData.
    // In a fully robust app, modifying _settings['tema_interface'] would trigger a Provider rebuild.
    setState(() => _saving = false);
    
    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Configurações salvas com sucesso!'), backgroundColor: Colors.green),
      );
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erro ao salvar as configurações.'), backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _toggleCloseFriend(User user) async {
    // Optimistic Update
    setState(() {
      final index = _closeFriends.indexWhere((u) => u.id == user.id);
      if (index != -1) {
        final current = _closeFriends[index];
        _closeFriends[index] = User(
          id: current.id,
          nomeUsuario: current.nomeUsuario,
          email: current.email,
          nomeCompleto: current.nomeCompleto,
          avatar: current.avatar,
          isCloseFriend: !current.isCloseFriend,
        );
      }
    });

    final success = await _settingsService.toggleCloseFriend(user.id);
    if (!success) {
      // Revert if failed
      setState(() {
        final index = _closeFriends.indexWhere((u) => u.id == user.id);
        if (index != -1) {
          final current = _closeFriends[index];
          _closeFriends[index] = User(
            id: current.id,
            nomeUsuario: current.nomeUsuario,
            email: current.email,
            nomeCompleto: current.nomeCompleto,
            avatar: current.avatar,
            isCloseFriend: !current.isCloseFriend, // revert
          );
        }
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro ao atualizar melhor amigo.'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Configurações'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: Theme.of(context).colorScheme.secondary,
          unselectedLabelColor: Colors.grey,
          indicatorColor: Theme.of(context).colorScheme.secondary,
          tabs: const [
            Tab(text: 'Geral', icon: Icon(Icons.settings)),
            Tab(text: 'Amigos', icon: Icon(Icons.star)),
            Tab(text: 'Alarme', icon: Icon(Icons.alarm)),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildGeneralTab(),
                _buildCloseFriendsTab(),
                _buildAlarmTab(),
              ],
            ),
      bottomNavigationBar: _tabController.index == 0
          ? Padding(
              padding: const EdgeInsets.all(16.0),
              child: ElevatedButton.icon(
                onPressed: _saving ? null : _saveSettings,
                icon: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Icon(Icons.save),
                label: const Text('Salvar Configurações'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            )
          : null,
      floatingActionButton: _tabController.index == 2
          ? FloatingActionButton(
              onPressed: () => _showAlarmConfigModal(context),
              backgroundColor: Theme.of(context).colorScheme.primary,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
    );
  }

  Widget _buildGeneralTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Notificações', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        SwitchListTile(
          title: const Text('Novos Seguidores'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _settings['notificacoes_seguidor_novo'] ?? true,
          onChanged: (val) => setState(() => _settings['notificacoes_seguidor_novo'] = val),
        ),
        SwitchListTile(
          title: const Text('Comentários'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _settings['notificacoes_comentarios'] ?? true,
          onChanged: (val) => setState(() => _settings['notificacoes_comentarios'] = val),
        ),
        SwitchListTile(
          title: const Text('Curtidas e Reações'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _settings['notificacoes_reacoes'] ?? true,
          onChanged: (val) => setState(() => _settings['notificacoes_reacoes'] = val),
        ),
        SwitchListTile(
          title: const Text('Mensagens Diretas'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _settings['notificacoes_mensagens_diretas'] ?? true,
          onChanged: (val) => setState(() => _settings['notificacoes_mensagens_diretas'] = val),
        ),
        SwitchListTile(
          title: const Text('Novas Publicações'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _settings['notificacoes_novas_publicacoes'] ?? true,
          onChanged: (val) => setState(() => _settings['notificacoes_novas_publicacoes'] = val),
        ),
        const Divider(),
        const Text('Privacidade', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        SwitchListTile(
          title: const Text('Conta Privada'),
          subtitle: const Text('Apenas seguidores aprovados podem ver suas publicações e mídias.'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _isPrivateLocal,
          onChanged: (val) async {
            setState(() => _isPrivateLocal = val);
            if (_currentUser != null) {
              final updated = await _userService.updateUser(_currentUser!.id, {
                'privacidade_padrao': val ? 2 : 1,
              });
              if (updated == null && mounted) {
                setState(() => _isPrivateLocal = !val);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Erro ao alterar privacidade.'), backgroundColor: Colors.red),
                );
              } else if (updated != null) {
                _currentUser = updated;
              }
            }
          },
        ),
        const Divider(),
        const Text('Aparência e Idioma', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        DropdownButtonFormField<int>(
          decoration: InputDecoration(
            labelText: 'Tema',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          value: _settings['tema_interface'] ?? 2,
          items: const [
            DropdownMenuItem(value: 1, child: Text('Claro')),
            DropdownMenuItem(value: 2, child: Text('Escuro')),
            DropdownMenuItem(value: 3, child: Text('Sistema')),
          ],
          onChanged: (val) {
            setState(() => _settings['tema_interface'] = val!);
            Provider.of<SettingsProvider>(context, listen: false).setTheme(val!);
          },
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          decoration: InputDecoration(
            labelText: 'Idioma',
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          value: _settings['idioma'] ?? 'pt-BR',
          items: const [
            DropdownMenuItem(value: 'pt-BR', child: Text('Português (BR)')),
            DropdownMenuItem(value: 'en', child: Text('English')),
          ],
          onChanged: (val) {
             setState(() => _settings['idioma'] = val!);
             Provider.of<SettingsProvider>(context, listen: false).setLocale(val!);
          },
        ),
        const Divider(height: 32),
        const Text('Feed', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        SwitchListTile(
          title: const Text('Mostrar Feed Para Você (Algoritmo)'),
          activeColor: Theme.of(context).colorScheme.secondary,
          value: _settings['mostrar_feed_algoritmico'] ?? true,
          onChanged: (val) {
            setState(() => _settings['mostrar_feed_algoritmico'] = val);
            Provider.of<SettingsProvider>(context, listen: false).setShowAlgorithmicFeed(val);
          },
        ),
      ],
    );
  }

  Widget _buildCloseFriendsTab() {
    final filteredFriends = _closeFriends.where((u) {
      if (_searchQuery.isEmpty) return true;
      return u.nomeUsuario.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          u.nomeCompleto.toLowerCase().contains(_searchQuery.toLowerCase());
    }).toList();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16.0),
          child: TextField(
            decoration: InputDecoration(
              labelText: 'Buscar amigos...',
              prefixIcon: const Icon(Icons.search),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: (val) => setState(() => _searchQuery = val),
          ),
        ),
        Expanded(
          child: _loadingFriends
              ? const Center(child: CircularProgressIndicator())
              : filteredFriends.isEmpty
                  ? const Center(child: Text('Nenhum usuário encontrado.'))
                  : ListView.builder(
                      itemCount: filteredFriends.length,
                      itemBuilder: (context, index) {
                        final user = filteredFriends[index];
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundImage: user.avatar != null ? NetworkImage(user.avatar!) : null,
                            child: user.avatar == null ? Text(user.nomeUsuario[0].toUpperCase()) : null,
                          ),
                          title: Text(user.nomeCompleto),
                          subtitle: Text('@${user.nomeUsuario}'),
                          trailing: IconButton(
                            icon: Icon(
                              user.isCloseFriend ? Icons.star : Icons.star_border,
                              color: user.isCloseFriend ? Colors.amber : Colors.grey,
                            ),
                            onPressed: () => _toggleCloseFriend(user),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  Widget _buildAlarmTab() {
    return Consumer<AlarmProvider>(
      builder: (context, alarmProvider, child) {
        final alarms = alarmProvider.alarms;

        return Column(
          children: [
            Expanded(
              child: alarms.isEmpty
                  ? const Center(child: Text("Nenhum alarme configurado."))
                  : ListView.builder(
                      itemCount: alarms.length,
                      itemBuilder: (context, index) {
                        final alarm = alarms[index];
                        final timeString = "${alarm.time.hour.toString().padLeft(2, '0')}:${alarm.time.minute.toString().padLeft(2, '0')}";
                        final daysList = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
                        List<String> activeDays = [];
                        for(int i = 0; i < 7; i++) {
                           if(alarm.daysOfWeek[i]) activeDays.add(daysList[i]);
                        }
                        return Card(
                          margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
                          child: ListTile(
                            contentPadding: const EdgeInsets.all(16.0),
                            title: Text(
                              timeString,
                              style: TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                                color: alarm.isActive ? null : Colors.grey,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const SizedBox(height: 4),
                                Text(alarm.label),
                                const SizedBox(height: 4),
                                Text(activeDays.isEmpty ? 'Toca 1 vez' : activeDays.join(', ')),
                              ],
                            ),
                            trailing: Switch(
                              value: alarm.isActive,
                              activeColor: Theme.of(context).colorScheme.primary,
                              onChanged: (val) {
                                alarmProvider.toggleAlarm(alarm.id);
                              },
                            ),
                            onLongPress: () {
                              alarmProvider.deleteAlarm(alarm.id);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Alarme removido')),
                              );
                            },
                            onTap: () {
                              _showAlarmConfigModal(context, alarmToEdit: alarm);
                            },
                          ),
                        );
                      },
                    ),
            ),
          ],
        );
      },
    );
  }

  void _showAlarmConfigModal(BuildContext context, {AlarmModel? alarmToEdit}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return _AlarmConfigModal(alarmToEdit: alarmToEdit);
      },
    );
  }
}

class _AlarmConfigModal extends StatefulWidget {
  final AlarmModel? alarmToEdit;

  const _AlarmConfigModal({this.alarmToEdit});

  @override
  _AlarmConfigModalState createState() => _AlarmConfigModalState();
}

class _AlarmConfigModalState extends State<_AlarmConfigModal> {
  late TimeOfDay _selectedTime;
  late String _label;
  late List<bool> _daysOfWeek;
  late String _selectedSound;
  late int _fadeInSeconds;
  late bool _showShortcut;

  final List<String> _soundOptions = [
    'assets/sounds/natureza.mp3',
    'assets/sounds/cosmos.mp3',
    'assets/sounds/oceano.mp3',
    'custom'
  ];

  @override
  void initState() {
    super.initState();
    if (widget.alarmToEdit != null) {
      _selectedTime = widget.alarmToEdit!.time;
      _label = widget.alarmToEdit!.label;
      _daysOfWeek = List.from(widget.alarmToEdit!.daysOfWeek);
      _selectedSound = widget.alarmToEdit!.selectedSound;
      _fadeInSeconds = widget.alarmToEdit!.fadeInDurationSeconds;
      _showShortcut = widget.alarmToEdit!.showRecordDreamShortcut;
    } else {
      _selectedTime = TimeOfDay.now();
      _label = 'Despertador';
      _daysOfWeek = List.filled(7, false);
      _selectedSound = _soundOptions[0];
      _fadeInSeconds = 30;
      _showShortcut = true;
    }
    
    // Fallback pra som customizado pra não quebrar a UI
    if (!_soundOptions.contains(_selectedSound) && !_selectedSound.startsWith('assets/')) {
       final hasCustom = _soundOptions.contains('custom');
       if(!hasCustom) _soundOptions.add('custom');
       _selectedSound = 'custom';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).scaffoldBackgroundColor,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 24,
        right: 24,
        top: 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Configurar Alarme', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                TextButton(
                  onPressed: () async {
                    String finalSoundToSave = _selectedSound;
                    if (_selectedSound == 'custom') {
                       FilePickerResult? result = await FilePicker.platform.pickFiles(type: FileType.audio);
                       if (result != null && result.files.single.path != null) {
                          finalSoundToSave = result.files.single.path!;
                       } else {
                          finalSoundToSave = 'assets/sounds/natureza.mp3'; // Fallback
                       }
                    }

                    final alarmProvider = Provider.of<AlarmProvider>(context, listen: false);
                    final newAlarm = AlarmModel(
                      id: widget.alarmToEdit?.id ?? 0,
                      time: _selectedTime,
                      label: _label,
                      daysOfWeek: _daysOfWeek,
                      selectedSound: finalSoundToSave,
                      fadeInDurationSeconds: _fadeInSeconds,
                      showRecordDreamShortcut: _showShortcut,
                      isActive: true,
                    );

                    if (widget.alarmToEdit != null) {
                      alarmProvider.updateAlarm(newAlarm);
                    } else {
                      alarmProvider.addAlarm(newAlarm);
                    }
                    Navigator.pop(context);
                  },
                  child: const Text('Salvar', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Center(
              child: GestureDetector(
                onTap: () async {
                  final time = await showTimePicker(
                    context: context, 
                    initialTime: _selectedTime,
                    initialEntryMode: TimePickerEntryMode.dial,
                    builder: (context, child) {
                      return Theme(
                        data: Theme.of(context).copyWith(
                          textButtonTheme: TextButtonThemeData(
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.blueAccent, // Botões ficam azuis e visíveis!
                              textStyle: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                        child: child!,
                      );
                    },
                  );
                  if (time != null) setState(() => _selectedTime = time);
                },
                child: Text(
                  "${_selectedTime.hour.toString().padLeft(2, '0')}:${_selectedTime.minute.toString().padLeft(2, '0')}",
                  style: TextStyle(
                    fontSize: 56,
                    fontWeight: FontWeight.bold,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            TextFormField(
              initialValue: _label,
              decoration: const InputDecoration(labelText: 'Rótulo', border: OutlineInputBorder()),
              onChanged: (val) => _label = val,
            ),
            const SizedBox(height: 16),
             const Text('Repetir (Seg a Dom):', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: List.generate(7, (index) {
                final days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
                return GestureDetector(
                  onTap: () => setState(() => _daysOfWeek[index] = !_daysOfWeek[index]),
                  child: CircleAvatar(
                    radius: 18,
                    backgroundColor: _daysOfWeek[index] ? Theme.of(context).colorScheme.primary : Colors.grey[300],
                    child: Text(
                      days[index],
                      style: TextStyle(
                        color: _daysOfWeek[index] ? Colors.white : Colors.black87,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                );
              }),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                const Icon(Icons.music_note),
                const SizedBox(width: 16),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    value: _selectedSound,
                    decoration: const InputDecoration(labelText: 'Som do Alarme', border: OutlineInputBorder()),
                    items: const [
                       DropdownMenuItem(value: 'assets/sounds/natureza.mp3', child: Text('Natureza')),
                       DropdownMenuItem(value: 'assets/sounds/cosmos.mp3', child: Text('Cosmos')),
                       DropdownMenuItem(value: 'assets/sounds/oceano.mp3', child: Text('Oceano')),
                       DropdownMenuItem(value: 'custom', child: Text('Aúdio do Dispositivo...')),
                    ],
                    onChanged: (val) => setState(() => _selectedSound = val!),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            SwitchListTile(
               contentPadding: EdgeInsets.zero,
               title: const Text('Atalho para Registrar Sonho'),
               subtitle: const Text('Exibe um botão grande para criar publicações ao acordar.'),
               activeColor: Theme.of(context).colorScheme.primary,
               value: _showShortcut,
               onChanged: (val) => setState(() => _showShortcut = val),
            ),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}
