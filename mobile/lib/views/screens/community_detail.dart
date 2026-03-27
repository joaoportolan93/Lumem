import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:lumem/models/community.dart';
import 'package:lumem/models/dream.dart';
import 'package:lumem/services/community_service.dart';
import 'package:lumem/views/widgets/dream_card.dart';
import 'package:lumem/views/screens/create_dream.dart';
import 'package:lumem/views/screens/mod_dashboard.dart';
import 'package:intl/intl.dart';

class CommunityDetail extends StatefulWidget {
  final String communityId;

  const CommunityDetail({super.key, required this.communityId});

  @override
  _CommunityDetailState createState() => _CommunityDetailState();
}

class _CommunityDetailState extends State<CommunityDetail>
    with SingleTickerProviderStateMixin {
  final CommunityService _communityService = CommunityService();
  late TabController _tabController;
  Community? _community;
  List<Dream> _posts = [];
  List<Map<String, dynamic>> _members = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      _communityService.getCommunityDetail(widget.communityId),
      _communityService.getCommunityPosts(widget.communityId),
      _communityService.getCommunityMembers(widget.communityId),
    ]);
    setState(() {
      _community = results[0] as Community?;
      _posts = results[1] as List<Dream>;
      _members = results[2] as List<Map<String, dynamic>>;
      _isLoading = false;
    });
  }

  Future<void> _toggleJoin() async {
    if (_community == null) return;

    setState(() => _isLoading = true);
    bool success;
    if (_community!.isMembro) {
      success = await _communityService.leaveCommunity(widget.communityId);
    } else {
      success = await _communityService.joinCommunity(widget.communityId);
    }

    if (success) {
      await _loadData();
    } else {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Erro ao atualizar participação.'),
              backgroundColor: Colors.red),
        );
      }
    }
  }

  bool get _isModOrAdmin {
    return _community?.cargo == 'admin' || _community?.cargo == 'moderator';
  }

  Future<void> _pickAndUploadIcon() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 50,
      maxWidth: 1024,
    );
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    final filename = picked.name.isNotEmpty ? picked.name : 'icon.jpg';
    final formData = FormData.fromMap({
      'image': MultipartFile.fromBytes(bytes, filename: filename),
    });

    final result =
        await _communityService.uploadCommunityIcon(widget.communityId, formData);
    if (result != null) {
      _loadData();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Erro ao enviar ícone.'),
            backgroundColor: Colors.red),
      );
    }
  }

  Future<void> _pickAndUploadBanner() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 60,
      maxWidth: 1920,
    );
    if (picked == null) return;

    final bytes = await picked.readAsBytes();
    final filename = picked.name.isNotEmpty ? picked.name : 'banner.jpg';
    final formData = FormData.fromMap({
      'image': MultipartFile.fromBytes(bytes, filename: filename),
    });

    final result = await _communityService.uploadCommunityBannerImage(
        widget.communityId, formData);
    if (result != null) {
      _loadData();
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
            content: Text('Erro ao enviar banner.'),
            backgroundColor: Colors.red),
      );
    }
  }

  void _showMenu() {
    if (_community == null) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_isModOrAdmin)
                ListTile(
                  leading: const Icon(Icons.admin_panel_settings),
                  title: const Text('Painel de Moderação'),
                  onTap: () {
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ModDashboard(
                          communityId: widget.communityId,
                          communityName: _community!.nome,
                        ),
                      ),
                    ).then((_) => _loadData());
                  },
                ),
              if (_community?.cargo == 'admin')
                ListTile(
                  leading: const Icon(Icons.delete_forever, color: Colors.red),
                  title: const Text('Excluir Comunidade',
                      style: TextStyle(color: Colors.red)),
                  onTap: () async {
                    Navigator.pop(context);
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                        title: const Text('Excluir Comunidade'),
                        content: const Text(
                            'Tem certeza que deseja excluir esta comunidade? Esta ação não pode ser desfeita.'),
                        actions: [
                          TextButton(
                              onPressed: () => Navigator.pop(c, false),
                              child: const Text('Cancelar')),
                          TextButton(
                              onPressed: () => Navigator.pop(c, true),
                              child: const Text('Excluir',
                                  style: TextStyle(color: Colors.red))),
                        ],
                      ),
                    );

                    if (confirm == true) {
                      setState(() => _isLoading = true);
                      final success = await _communityService
                          .deleteCommunity(widget.communityId);
                      if (success && mounted) {
                        Navigator.pop(context);
                      } else if (mounted) {
                        setState(() => _isLoading = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Erro ao excluir comunidade.'),
                              backgroundColor: Colors.red),
                        );
                      }
                    }
                  },
                ),
              if (_community?.isMembro == true && _community?.cargo != 'admin')
                ListTile(
                  leading: const Icon(Icons.exit_to_app, color: Colors.red),
                  title: const Text('Sair da comunidade',
                      style: TextStyle(color: Colors.red)),
                  onTap: () {
                    Navigator.pop(context);
                    _toggleJoin();
                  },
                ),
              if (_community?.isMembro != true)
                ListTile(
                  leading: const Icon(Icons.person_add),
                  title: const Text('Entrar na comunidade'),
                  onTap: () {
                    Navigator.pop(context);
                    _toggleJoin();
                  },
                ),
              if (_community?.isMembro == true)
                ListTile(
                  leading: const Icon(Icons.notifications_off),
                  title: const Text('Silenciar Notificações'),
                  onTap: () {
                    Navigator.pop(context);
                  },
                ),
              ListTile(
                leading: const Icon(Icons.report, color: Colors.orange),
                title: const Text('Denunciar Comunidade',
                    style: TextStyle(color: Colors.orange)),
                onTap: () {
                  Navigator.pop(context);
                  _showReportDialog();
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showReportDialog() {
    final reasons = [
      'Spam ou conteúdo irrelevante',
      'Discurso de ódio ou preconceito',
      'Conteúdo sexual inapropriado',
      'Violência ou conteúdo perturbador',
      'Desinformação',
      'Outro',
    ];

    showDialog(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Por que está denunciando?'),
        children: reasons
            .map(
              (reason) => SimpleDialogOption(
                onPressed: () {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Denúncia enviada: $reason'),
                      backgroundColor: Colors.orange,
                    ),
                  );
                },
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Text(reason),
                ),
              ),
            )
            .toList(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _community == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (_community == null) {
      return Scaffold(
        appBar: AppBar(),
        body: const Center(child: Text('Comunidade não encontrada.')),
      );
    }

    final theme = Theme.of(context);

    return Scaffold(
      floatingActionButton: _community!.isMembro
          ? FloatingActionButton(
              heroTag: 'fab_add_post_${widget.communityId}',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) =>
                        CreateDream(communityId: widget.communityId),
                  ),
                ).then((_) => _loadData());
              },
              backgroundColor: theme.colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) {
          return [
            // SliverAppBar com Banner
            SliverAppBar(
              expandedHeight: 200,
              pinned: true,
              actions: [
                IconButton(
                  icon: const Icon(Icons.more_vert),
                  onPressed: _showMenu,
                ),
              ],
              flexibleSpace: FlexibleSpaceBar(
                background: Stack(
                  fit: StackFit.expand,
                  children: [
                    _community?.banner != null
                        ? CachedNetworkImage(
                            imageUrl: _community!.banner!,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => Container(
                              decoration: const BoxDecoration(
                                gradient: LinearGradient(
                                  colors: [
                                    Color(0xFF311B92),
                                    Color(0xFF4A148C)
                                  ],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                              ),
                            ),
                          )
                        : Container(
                            decoration: const BoxDecoration(
                              gradient: LinearGradient(
                                colors: [
                                  Color(0xFF311B92),
                                  Color(0xFF4A148C)
                                ],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                            ),
                          ),
                    // Botão para trocar banner (Mod/Admin)
                    if (_isModOrAdmin)
                      Positioned(
                        bottom: 8,
                        right: 8,
                        child: Material(
                          color: Colors.black45,
                          borderRadius: BorderRadius.circular(20),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(20),
                            onTap: _pickAndUploadBanner,
                            child: const Padding(
                              padding: EdgeInsets.all(8),
                              child: Icon(Icons.camera_alt,
                                  color: Colors.white, size: 20),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
            // Header da Comunidade
            SliverToBoxAdapter(
              child: _buildCommunityHeader(theme),
            ),
            // Tab Bar
            SliverPersistentHeader(
              pinned: true,
              delegate: _TabBarDelegate(
                TabBar(
                  controller: _tabController,
                  labelColor: theme.colorScheme.secondary,
                  unselectedLabelColor: Colors.grey,
                  indicatorColor: theme.colorScheme.secondary,
                  tabs: const [
                    Tab(text: 'Feed'),
                    Tab(text: 'Sobre'),
                  ],
                ),
              ),
            ),
          ];
        },
        body: TabBarView(
          controller: _tabController,
          children: [
            _buildFeedTab(),
            _buildAboutTab(),
          ],
        ),
      ),
    );
  }

  Widget _buildCommunityHeader(ThemeData theme) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 56, left: 16, right: 16, bottom: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(_community!.nome,
                  style:
                      const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
            if (_community!.descricao != null)
              Text(_community!.descricao!,
                  style: TextStyle(fontSize: 14, color: Colors.grey[600])),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.people, size: 16, color: Colors.grey),
                const SizedBox(width: 4),
                Text('${_community!.membrosCount} membros',
                    style: const TextStyle(
                        color: Colors.grey, fontWeight: FontWeight.bold)),
                if (_community!.cargo != null) ...[
                  const SizedBox(width: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color:
                          theme.colorScheme.secondary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      _community!.cargo == 'admin'
                          ? 'Admin'
                          : 'Moderador',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: theme.colorScheme.secondary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
            ],
          ),
        ),
        // Positioned Avatar
        Positioned(
          top: -40,
          left: 16,
          child: Stack(
            children: [
              Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: theme.scaffoldBackgroundColor, width: 4),
                ),
                child: CircleAvatar(
                  radius: 40,
                  backgroundColor: theme.colorScheme.primary,
                  backgroundImage: _community!.imagem != null
                      ? CachedNetworkImageProvider(_community!.imagem!)
                      : null,
                  child: _community!.imagem == null
                      ? Text(
                          _community!.nome[0].toUpperCase(),
                          style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: Colors.white),
                        )
                      : null,
                ),
              ),
              if (_isModOrAdmin)
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: GestureDetector(
                    onTap: _pickAndUploadIcon,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        color: theme.colorScheme.primary,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: theme.scaffoldBackgroundColor,
                            width: 2),
                      ),
                      child: const Icon(Icons.camera_alt,
                          color: Colors.white, size: 14),
                    ),
                  ),
                ),
            ],
          ),
        ),
        // Positioned Join Button
        Positioned(
          top: 8,
          right: 16,
          child: ElevatedButton(
            onPressed: _community!.cargo == 'admin' ? null : _toggleJoin, // Admins don't need to join/leave
            style: ElevatedButton.styleFrom(
              backgroundColor: _community!.isMembro
                  ? theme.colorScheme.surfaceContainerHighest
                  : theme.colorScheme.primary,
              foregroundColor:
                  _community!.isMembro ? theme.colorScheme.onSurface : Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20)),
              elevation: _community!.isMembro ? 0 : 2,
            ),
            child: Text(_community!.isMembro ? 'Membro' : 'Entrar'),
          ),
        ),
      ],
    );
  }

  // ===================== ABA FEED =====================
  Widget _buildFeedTab() {
    if (_posts.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.nightlight_round, size: 64, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text('Nenhum sonho compartilhado ainda.',
                style: TextStyle(color: Colors.grey[500])),
          ],
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadData,
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        itemCount: _posts.length,
        itemBuilder: (context, index) {
          return DreamCard(dream: _posts[index], onUpdate: _loadData);
        },
      ),
    );
  }

  // ===================== ABA SOBRE =====================
  Widget _buildAboutTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Descrição
        if (_community!.descricao != null &&
            _community!.descricao!.isNotEmpty) ...[
          const Text('Descrição',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(_community!.descricao!,
              style: TextStyle(fontSize: 14, color: Colors.grey[700], height: 1.5)),
          const SizedBox(height: 24),
        ],

        // Data de Criação
        Row(
          children: [
            Icon(Icons.calendar_today, size: 16, color: Colors.grey[500]),
            const SizedBox(width: 8),
            Text(
              'Criada em ${DateFormat('dd/MM/yyyy').format(_community!.dataCriacao)}',
              style: TextStyle(fontSize: 13, color: Colors.grey[600]),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Regras
        const Text('Regras da Comunidade',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 12),
        if (_community!.regras == null || _community!.regras!.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8.0),
            child: Text('Essa comunidade ainda não tem regras.',
                style: TextStyle(
                    color: Colors.grey[500], fontStyle: FontStyle.italic)),
          )
        else
          Container(
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Theme.of(context).dividerColor.withValues(alpha: 0.1)),
            ),
            child: Column(
              children: _community!.regras!.asMap().entries.map((entry) {
                int idx = entry.key;
                var reg = entry.value;
                return Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    title: Text('${idx + 1}. ${reg['titulo'] ?? ''}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 14)),
                    tilePadding: const EdgeInsets.symmetric(horizontal: 16),
                    childrenPadding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                    children: [
                      if (reg['descricao'] != null &&
                          reg['descricao'].toString().isNotEmpty)
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Text(reg['descricao'],
                              style:
                                  TextStyle(color: Colors.grey[700], fontSize: 13)),
                        ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        const SizedBox(height: 24),

        // Moderadores
        const Text('Moderadores',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        ..._buildModeratorsList(),
      ],
    );
  }

  List<Widget> _buildModeratorsList() {
    final mods = _members.where((m) {
      final cargo = m['cargo'] ?? m['role'] ?? '';
      return cargo == 'admin' || cargo == 'moderator';
    }).toList();

    if (mods.isEmpty) {
      return [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8.0),
          child: Text('Nenhum moderador encontrado.',
              style: TextStyle(
                  color: Colors.grey[500], fontStyle: FontStyle.italic)),
        ),
      ];
    }

    return mods.map((mod) {
      final nome = mod['nome_completo'] ?? mod['nome_usuario'] ?? 'Usuário';
      final username = mod['nome_usuario'] ?? '';
      final avatar = mod['avatar_url'] ?? mod['avatar'];
      final cargo = mod['cargo'] ?? mod['role'] ?? '';

      return ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(
          backgroundImage: avatar != null ? CachedNetworkImageProvider(avatar) : null,
          child: avatar == null
              ? Text(nome.substring(0, 1).toUpperCase())
              : null,
        ),
        title: Text(nome, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Text('@$username'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: cargo == 'admin'
                ? Colors.amber.withValues(alpha: 0.2)
                : Colors.blue.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            cargo == 'admin' ? 'Admin' : 'Mod',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: cargo == 'admin' ? Colors.amber[800] : Colors.blue[700],
            ),
          ),
        ),
      );
    }).toList();
  }
}

class _TabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar _tabBar;
  _TabBarDelegate(this._tabBar);

  @override
  double get minExtent => _tabBar.preferredSize.height;
  @override
  double get maxExtent => _tabBar.preferredSize.height;

  @override
  Widget build(
      BuildContext context, double shrinkOffset, bool overlapsContent) {
    return Container(
      color: Theme.of(context).scaffoldBackgroundColor,
      child: _tabBar,
    );
  }

  @override
  bool shouldRebuild(_TabBarDelegate oldDelegate) => false;
}
