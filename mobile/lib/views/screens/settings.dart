import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:dreamshare/models/user.dart';
import 'package:dreamshare/services/settings_service.dart';
import 'package:dreamshare/services/auth_service.dart';
import 'package:dreamshare/providers/settings_provider.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  _SettingsScreenState createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final SettingsService _settingsService = SettingsService();
  final AuthService _authService = AuthService();

  bool _isLoading = true;
  bool _saving = false;
  Map<String, dynamic> _settings = {};

  List<User> _closeFriends = [];
  bool _loadingFriends = false;
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.index == 1 && _closeFriends.isEmpty) {
        _loadCloseFriends();
      }
    });
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    await _authService.getProfile();
    final settings = await _settingsService.getUserSettings();
    setState(() {
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
          tabs: const [
            Tab(text: 'Geral', icon: Icon(Icons.settings)),
            Tab(text: 'Melhores Amigos', icon: Icon(Icons.star)),
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
}
