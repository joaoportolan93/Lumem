import 'dart:io';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:lumem/services/community_service.dart';

class ModDashboard extends StatefulWidget {
  final String communityId;
  final String communityName;

  const ModDashboard({
    super.key,
    required this.communityId,
    required this.communityName,
  });

  @override
  _ModDashboardState createState() => _ModDashboardState();
}

class _ModDashboardState extends State<ModDashboard> {
  final CommunityService _communityService = CommunityService();

  bool _isLoading = true;
  List<Map<String, dynamic>> _members = [];
  List<Map<String, dynamic>> _bannedMembers = [];
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      _communityService.getCommunityMembers(widget.communityId),
      _communityService.getBannedMembers(widget.communityId),
      _communityService.getCommunityStats(widget.communityId),
    ]);
    setState(() {
      _members = results[0] as List<Map<String, dynamic>>;
      _bannedMembers = results[1] as List<Map<String, dynamic>>;
      _stats = results[2] as Map<String, dynamic>?;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text('Moderação: ${widget.communityName}'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  // ============ Métricas ============
                  _buildSectionTitle('Métricas'),
                  const SizedBox(height: 8),
                  _buildStatsCards(theme),
                  const SizedBox(height: 24),

                  // ============ Ações Rápidas ============
                  _buildSectionTitle('Ações Rápidas'),
                  const SizedBox(height: 8),
                  _buildQuickActions(theme),
                  const SizedBox(height: 24),

                  // ============ Membros ============
                  _buildSectionTitle('Membros (${_members.length})'),
                  const SizedBox(height: 8),
                  ..._members.map((m) => _buildMemberTile(m, theme)),

                  if (_bannedMembers.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    _buildSectionTitle(
                        'Banidos (${_bannedMembers.length})'),
                    const SizedBox(height: 8),
                    ..._bannedMembers
                        .map((m) => _buildBannedMemberTile(m, theme)),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
    );
  }

  // ============ Métricas Cards ============
  Widget _buildStatsCards(ThemeData theme) {
    final totalMembros = _stats?['total_membros'] ?? _members.length;
    final novosMembros7d = _stats?['novos_membros_7d'] ?? 0;
    final totalPosts = _stats?['total_posts'] ?? 0;
    final postsUltimos7d = _stats?['posts_7d'] ?? 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _buildStatCard(
          'Total de Membros',
          totalMembros.toString(),
          Icons.people,
          theme.colorScheme.primary,
        ),
        _buildStatCard(
          'Novos (7 dias)',
          '+$novosMembros7d',
          Icons.trending_up,
          Colors.green,
        ),
        _buildStatCard(
          'Total de Posts',
          totalPosts.toString(),
          Icons.article,
          theme.colorScheme.secondary,
        ),
        _buildStatCard(
          'Posts (7 dias)',
          '+$postsUltimos7d',
          Icons.auto_graph,
          Colors.orange,
        ),
      ],
    );
  }

  Widget _buildStatCard(
      String label, String value, IconData icon, Color color) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 6),
                Text(value,
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: color)),
              ],
            ),
            const SizedBox(height: 6),
            Text(label,
                style: TextStyle(fontSize: 12, color: Colors.grey[600])),
          ],
        ),
      ),
    );
  }

  // ============ Ações Rápidas ============
  Widget _buildQuickActions(ThemeData theme) {
    return Column(
      children: [
        _buildActionTile(
          icon: Icons.image,
          title: 'Alterar Ícone da Comunidade',
          color: theme.colorScheme.primary,
          onTap: _pickAndUploadIcon,
        ),
        _buildActionTile(
          icon: Icons.panorama,
          title: 'Alterar Banner da Comunidade',
          color: theme.colorScheme.secondary,
          onTap: _pickAndUploadBanner,
        ),
        _buildActionTile(
          icon: Icons.edit,
          title: 'Editar Detalhes da Comunidade',
          color: Colors.teal,
          onTap: _showEditDetailsSheet,
        ),
        _buildActionTile(
          icon: Icons.rule,
          title: 'Editar Regras',
          color: Colors.orange,
          onTap: _showEditRulesSheet,
        ),
      ],
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String title,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 22),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }

  // ============ Upload Ícone e Banner ============
  Future<void> _pickAndUploadIcon() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _isLoading = true);
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(picked.path,
          filename: picked.path.split(Platform.pathSeparator).last),
    });
    final result = await _communityService.uploadCommunityIcon(
        widget.communityId, formData);
    setState(() => _isLoading = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result != null
              ? 'Ícone atualizado!'
              : 'Erro ao enviar ícone.'),
          backgroundColor: result != null ? Colors.green : Colors.red,
        ),
      );
    }
  }

  Future<void> _pickAndUploadBanner() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _isLoading = true);
    final formData = FormData.fromMap({
      'image': await MultipartFile.fromFile(picked.path,
          filename: picked.path.split(Platform.pathSeparator).last),
    });
    final result = await _communityService.uploadCommunityBannerImage(
        widget.communityId, formData);
    setState(() => _isLoading = false);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result != null
              ? 'Banner atualizado!'
              : 'Erro ao enviar banner.'),
          backgroundColor: result != null ? Colors.green : Colors.red,
        ),
      );
    }
  }

  // ============ Editar Detalhes ============
  void _showEditDetailsSheet() {
    final nameController = TextEditingController();
    final descController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('Editar Detalhes',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              TextField(
                controller: nameController,
                maxLength: 21,
                decoration: InputDecoration(
                  labelText: 'Novo Nome (deixe vazio para manter)',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: descController,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Nova Descrição (deixe vazio para manter)',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () async {
                  final data = <String, dynamic>{};
                  if (nameController.text.trim().isNotEmpty) {
                    data['nome'] = nameController.text.trim();
                  }
                  if (descController.text.trim().isNotEmpty) {
                    data['descricao'] = descController.text.trim();
                  }
                  if (data.isEmpty) {
                    Navigator.pop(ctx);
                    return;
                  }
                  Navigator.pop(ctx);
                  setState(() => _isLoading = true);
                  final result = await _communityService.updateCommunity(
                      widget.communityId, data);
                  setState(() => _isLoading = false);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(result != null
                            ? 'Detalhes atualizados!'
                            : 'Erro ao atualizar.'),
                        backgroundColor:
                            result != null ? Colors.green : Colors.red,
                      ),
                    );
                  }
                  _loadAll();
                },
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Salvar'),
              ),
            ],
          ),
        );
      },
    );
  }

  // ============ Editar Regras ============
  void _showEditRulesSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return _EditRulesSheet(
          communityId: widget.communityId,
          communityService: _communityService,
          onSaved: _loadAll,
        );
      },
    );
  }

  // ============ Membros ============
  Widget _buildMemberTile(Map<String, dynamic> member, ThemeData theme) {
    final nome =
        member['nome_completo'] ?? member['nome_usuario'] ?? 'Usuário';
    final username = member['nome_usuario'] ?? '';
    final avatar = member['avatar_url'] ?? member['avatar'];
    final cargo = member['cargo'] ?? member['role'] ?? 'membro';
    final userId =
        member['id_usuario']?.toString() ?? member['id']?.toString() ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: CircleAvatar(
          backgroundImage: avatar != null ? NetworkImage(avatar) : null,
          child: avatar == null
              ? Text(nome.substring(0, 1).toUpperCase())
              : null,
        ),
        title: Text(nome, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('@$username'),
        trailing: PopupMenuButton<String>(
          icon: const Icon(Icons.more_vert),
          onSelected: (action) => _handleMemberAction(action, userId, nome),
          itemBuilder: (_) => [
            if (cargo != 'admin')
              const PopupMenuItem(
                  value: 'promote_mod',
                  child: Text('Promover a Moderador')),
            if (cargo == 'moderator')
              const PopupMenuItem(
                  value: 'demote',
                  child: Text('Rebaixar para Membro')),
            if (cargo != 'admin')
              const PopupMenuItem(
                value: 'kick',
                child:
                    Text('Expulsar', style: TextStyle(color: Colors.orange)),
              ),
            if (cargo != 'admin')
              const PopupMenuItem(
                value: 'ban',
                child: Text('Banir', style: TextStyle(color: Colors.red)),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleMemberAction(
      String action, String userId, String nome) async {
    if (action == 'promote_mod') {
      setState(() => _isLoading = true);
      final success = await _communityService.manageCommunityRole(
          widget.communityId, userId, 'moderator');
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                success ? '$nome promovido a moderador!' : 'Erro na operação.'),
            backgroundColor: success ? Colors.green : Colors.red,
          ),
        );
      }
      _loadAll();
    } else if (action == 'demote') {
      setState(() => _isLoading = true);
      final success = await _communityService.manageCommunityRole(
          widget.communityId, userId, 'member');
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success
                ? '$nome rebaixado para membro.'
                : 'Erro na operação.'),
            backgroundColor: success ? Colors.green : Colors.red,
          ),
        );
      }
      _loadAll();
    } else if (action == 'kick') {
      final confirm = await showDialog<bool>(
        context: context,
        builder: (c) => AlertDialog(
          title: const Text('Expulsar Membro'),
          content: Text('Tem certeza que deseja expulsar $nome?'),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(c, false),
                child: const Text('Cancelar')),
            TextButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('Expulsar',
                    style: TextStyle(color: Colors.orange))),
          ],
        ),
      );
      if (confirm == true) {
        setState(() => _isLoading = true);
        final success = await _communityService.manageCommunityRole(
            widget.communityId, userId, 'kick');
        setState(() => _isLoading = false);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content:
                  Text(success ? '$nome foi expulso.' : 'Erro na operação.'),
              backgroundColor: success ? Colors.green : Colors.red,
            ),
          );
        }
        _loadAll();
      }
    } else if (action == 'ban') {
      _showBanDialog(userId, nome);
    }
  }

  void _showBanDialog(String userId, String nome) {
    final motivoController = TextEditingController();
    showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Banir $nome'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Informe o motivo do banimento (opcional):'),
            const SizedBox(height: 12),
            TextField(
              controller: motivoController,
              maxLines: 2,
              decoration: InputDecoration(
                hintText: 'Motivo...',
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c),
              child: const Text('Cancelar')),
          TextButton(
              onPressed: () async {
                Navigator.pop(c);
                setState(() => _isLoading = true);
                final success = await _communityService.banCommunityMember(
                    widget.communityId, userId,
                    motivo: motivoController.text.trim());
                setState(() => _isLoading = false);
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(
                          success ? '$nome foi banido.' : 'Erro ao banir.'),
                      backgroundColor: success ? Colors.green : Colors.red,
                    ),
                  );
                }
                _loadAll();
              },
              child: const Text('Banir',
                  style: TextStyle(color: Colors.red))),
        ],
      ),
    );
  }

  // ============ Membros Banidos ============
  Widget _buildBannedMemberTile(
      Map<String, dynamic> member, ThemeData theme) {
    final nome =
        member['nome_completo'] ?? member['nome_usuario'] ?? 'Usuário';
    final username = member['nome_usuario'] ?? '';
    final avatar = member['avatar_url'] ?? member['avatar'];
    final userId =
        member['id_usuario']?.toString() ?? member['id']?.toString() ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 4),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      color: Colors.red.withValues(alpha: 0.05),
      child: ListTile(
        leading: CircleAvatar(
          backgroundImage: avatar != null ? NetworkImage(avatar) : null,
          backgroundColor: Colors.red.withValues(alpha: 0.2),
          child: avatar == null
              ? Text(nome.substring(0, 1).toUpperCase())
              : null,
        ),
        title: Text(nome,
            style: const TextStyle(
                fontWeight: FontWeight.bold,
                decoration: TextDecoration.lineThrough)),
        subtitle: Text('@$username'),
        trailing: TextButton(
          onPressed: () async {
            setState(() => _isLoading = true);
            final success = await _communityService.unbanCommunityMember(
                widget.communityId, userId);
            setState(() => _isLoading = false);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(success
                      ? '$nome foi desbanido.'
                      : 'Erro ao desbanir.'),
                  backgroundColor: success ? Colors.green : Colors.red,
                ),
              );
            }
            _loadAll();
          },
          child: const Text('Desbanir',
              style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
        ),
      ),
    );
  }
}

// ============ Widget: Edição de Regras ============
class _EditRulesSheet extends StatefulWidget {
  final String communityId;
  final CommunityService communityService;
  final VoidCallback onSaved;

  const _EditRulesSheet({
    required this.communityId,
    required this.communityService,
    required this.onSaved,
  });

  @override
  _EditRulesSheetState createState() => _EditRulesSheetState();
}

class _EditRulesSheetState extends State<_EditRulesSheet> {
  final List<Map<String, String>> _rules = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _loadRules();
  }

  Future<void> _loadRules() async {
    final community =
        await widget.communityService.getCommunityDetail(widget.communityId);
    if (community?.regras != null) {
      setState(() {
        _rules.clear();
        for (var r in community!.regras!) {
          _rules.add({
            'titulo': r['titulo']?.toString() ?? '',
            'descricao': r['descricao']?.toString() ?? '',
          });
        }
      });
    }
  }

  void _addRule() {
    setState(() {
      _rules.add({'titulo': '', 'descricao': ''});
    });
  }

  void _removeRule(int index) {
    setState(() {
      _rules.removeAt(index);
    });
  }

  Future<void> _saveRules() async {
    setState(() => _saving = true);
    final cleanRules =
        _rules.where((r) => r['titulo']!.isNotEmpty).toList();
    final result = await widget.communityService.updateCommunity(
      widget.communityId,
      {'regras': jsonEncode(cleanRules)},
    );
    setState(() => _saving = false);

    if (mounted) {
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(result != null
              ? 'Regras atualizadas!'
              : 'Erro ao salvar regras.'),
          backgroundColor: result != null ? Colors.green : Colors.red,
        ),
      );
      widget.onSaved();
    }
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.7,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      expand: false,
      builder: (ctx, scrollController) {
        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Text('Editar Regras',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _addRule,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Adicionar'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  itemCount: _rules.length,
                  itemBuilder: (context, index) {
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Column(
                                children: [
                                  TextFormField(
                                    initialValue: _rules[index]['titulo'],
                                    onChanged: (val) =>
                                        _rules[index]['titulo'] = val,
                                    decoration: const InputDecoration(
                                      labelText: 'Título da Regra',
                                      isDense: true,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  TextFormField(
                                    initialValue: _rules[index]['descricao'],
                                    onChanged: (val) =>
                                        _rules[index]['descricao'] = val,
                                    maxLines: 2,
                                    decoration: const InputDecoration(
                                      labelText: 'Descrição (opcional)',
                                      isDense: true,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            IconButton(
                              icon:
                                  const Icon(Icons.close, color: Colors.red),
                              onPressed: () => _removeRule(index),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: _saving ? null : _saveRules,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2))
                    : const Text('Salvar Regras'),
              ),
            ],
          ),
        );
      },
    );
  }
}
