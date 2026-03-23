import 'package:flutter/material.dart';
import 'package:dreamshare/models/community.dart';
import 'package:dreamshare/models/dream.dart';
import 'package:dreamshare/services/community_service.dart';
import 'package:dreamshare/views/widgets/dream_card.dart';

class CommunityDetail extends StatefulWidget {
  final String communityId;

  const CommunityDetail({super.key, required this.communityId});

  @override
  _CommunityDetailState createState() => _CommunityDetailState();
}

class _CommunityDetailState extends State<CommunityDetail> {
  final CommunityService _communityService = CommunityService();
  Community? _community;
  List<Dream> _posts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final results = await Future.wait([
      _communityService.getCommunityDetail(widget.communityId),
      _communityService.getCommunityPosts(widget.communityId),
    ]);
    setState(() {
      _community = results[0] as Community?;
      _posts = results[1] as List<Dream>;
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
          const SnackBar(content: Text('Erro ao atualizar participação.'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showMenu() {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_community?.isMembro == true) ...[
                ListTile(
                  leading: Icon(_community!.isMembro ? Icons.exit_to_app : Icons.person_add),
                  title: Text(_community!.isMembro ? 'Sair da Comunidade' : 'Entrar na Comunidade'),
                  onTap: () {
                    Navigator.pop(context);
                    _toggleJoin();
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.notifications_off),
                  title: const Text('Silenciar Notificações'),
                  onTap: () => Navigator.pop(context),
                ),
                ListTile(
                  leading: const Icon(Icons.flag, color: Colors.red),
                  title: const Text('Denunciar Comunidade', style: TextStyle(color: Colors.red)),
                  onTap: () => Navigator.pop(context),
                ),
              ],
              if (_community?.cargo == 'admin') ...[
                const Divider(),
                ListTile(
                  leading: const Icon(Icons.delete, color: Colors.red),
                  title: const Text('Excluir Comunidade', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                  onTap: () async {
                    Navigator.pop(context);
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (c) => AlertDialog(
                        title: const Text('Excluir Comunidade'),
                        content: const Text('Tem certeza que deseja excluir esta comunidade? Esta ação não pode ser desfeita.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancelar')),
                          TextButton(onPressed: () => Navigator.pop(c, true), child: const Text('Excluir', style: TextStyle(color: Colors.red))),
                        ],
                      ),
                    );

                    if (confirm == true) {
                      setState(() => _isLoading = true);
                      final success = await _communityService.deleteCommunity(widget.communityId);
                      if (success && mounted) {
                        Navigator.pop(context); // Go back to Communities list
                      } else if (mounted) {
                        setState(() => _isLoading = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Erro ao excluir comunidade.'), backgroundColor: Colors.red),
                        );
                      }
                    }
                  },
                ),
              ],
            ],
          ),
        );
      },
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
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          // Add Post logic here
        },
        child: const Icon(Icons.add),
      ),
      body: CustomScrollView(
        slivers: [
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
              background: _community?.banner != null
                  ? Image.network(_community!.banner!, fit: BoxFit.cover)
                  : Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF311B92), Color(0xFF4A148C)], // Deep purple gradient as fallback
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                    ),
            ),
          ),
          SliverToBoxAdapter(
            child: Transform.translate(
              offset: const Offset(0, -40),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Theme.of(context).scaffoldBackgroundColor, width: 4),
                          ),
                          child: CircleAvatar(
                            radius: 40,
                            backgroundColor: theme.colorScheme.primary,
                            backgroundImage: _community!.imagem != null ? NetworkImage(_community!.imagem!) : null,
                            child: _community!.imagem == null
                                ? Text(_community!.nome[0].toUpperCase(), style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold, color: Colors.white))
                                : null,
                          ),
                        ),
                        const Spacer(),
                        ElevatedButton(
                          onPressed: _toggleJoin,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _community!.isMembro ? Colors.grey[300] : theme.colorScheme.primary,
                            foregroundColor: _community!.isMembro ? Colors.black87 : Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                            elevation: _community!.isMembro ? 0 : 2,
                          ),
                          child: Text(_community!.isMembro ? 'Membro' : 'Entrar'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_community!.nome, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        if (_community!.descricao != null)
                          Text(_community!.descricao!, style: TextStyle(fontSize: 14, color: Colors.grey[700])),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.people, size: 16, color: Colors.grey),
                            const SizedBox(width: 4),
                            Text('${_community!.membrosCount} membros', style: const TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 32, thickness: 1),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: const Text('Regras da Comunidade', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                  if (_community!.regras == null || _community!.regras!.isEmpty)
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text('Essa comunidade ainda não tem regras.', style: TextStyle(color: Colors.grey[500], fontStyle: FontStyle.italic)),
                    )
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Column(
                        children: _community!.regras!.asMap().entries.map((entry) {
                          int idx = entry.key;
                          var reg = entry.value;
                          return ExpansionTile(
                            title: Text('${idx + 1}. ${reg['titulo'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            tilePadding: EdgeInsets.zero,
                            childrenPadding: const EdgeInsets.only(bottom: 12),
                            children: [
                              if (reg['descricao'] != null && reg['descricao'].toString().isNotEmpty)
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(reg['descricao'], style: TextStyle(color: Colors.grey[700], fontSize: 13)),
                                ),
                            ],
                          );
                        }).toList(),
                      ),
                    ),
                  const Divider(thickness: 8, color: Colors.black12),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: const Text('Publicações', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
          if (_posts.isEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Center(
                  child: Text('Nenhum sonho compartilhado ainda.', style: TextStyle(color: Colors.grey[500])),
                ),
              ),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  return Transform.translate(
                    offset: const Offset(0, -40),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0),
                      child: DreamCard(dream: _posts[index], onUpdate: _loadData),
                    ),
                  );
                },
                childCount: _posts.length,
              ),
            ),
        ],
      ),
    );
  }
}
