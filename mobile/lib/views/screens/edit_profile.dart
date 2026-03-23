import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:dreamshare/models/user.dart';
import 'package:dreamshare/services/api_client.dart';
import 'package:dio/dio.dart';

class EditProfile extends StatefulWidget {
  final User user;

  const EditProfile({super.key, required this.user});

  @override
  _EditProfileState createState() => _EditProfileState();
}

class _EditProfileState extends State<EditProfile> {
  late TextEditingController _nameController;
  late TextEditingController _usernameController;
  late TextEditingController _bioController;
  DateTime? _dataNascimento;
  File? _newAvatar;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _nameController = TextEditingController(text: widget.user.nomeCompleto);
    _usernameController = TextEditingController(text: widget.user.nomeUsuario);
    _bioController = TextEditingController(text: widget.user.bio ?? '');
    _dataNascimento = widget.user.dataNascimento;
  }

  @override
  void dispose() {
    _nameController.dispose();
    _usernameController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    try {
      final picker = ImagePicker();
      final image = await picker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 512,
        maxHeight: 512,
        imageQuality: 80,
      );
      if (image != null) {
        setState(() => _newAvatar = File(image.path));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Erro ao selecionar imagem')),
        );
      }
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _dataNascimento ?? DateTime(2000, 1, 1),
      firstDate: DateTime(1900),
      lastDate: now,
      locale: const Locale('pt', 'BR'),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: Theme.of(context).colorScheme.copyWith(
                  primary: const Color(0xFF764BA2),
                ),
          ),
          child: child!,
        );
      },
    );
    if (date != null) {
      setState(() => _dataNascimento = date);
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _isSaving = true);

    try {
      final api = ApiClient();
      final formData = FormData.fromMap({
        'nome_completo': _nameController.text.trim(),
        'nome_usuario': _usernameController.text.trim(),
        'bio': _bioController.text.trim(),
        if (_dataNascimento != null)
          'data_nascimento':
              DateFormat('yyyy-MM-dd').format(_dataNascimento!),
        if (_newAvatar != null)
          'avatar': await MultipartFile.fromFile(
            _newAvatar!.path,
            filename: _newAvatar!.path.split(Platform.pathSeparator).last,
          ),
      });

      await api.dio.put('profile/', data: formData);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Perfil atualizado com sucesso!')),
        );
        Navigator.pop(context, true);
      }
    } on DioException catch (e) {
      if (mounted) {
        String msg = 'Erro ao salvar';
        if (e.response?.data is Map) {
          final data = e.response!.data as Map;
          for (var value in data.values) {
            if (value is List && value.isNotEmpty) {
              msg = value.first.toString();
              break;
            }
            if (value is String) {
              msg = value;
              break;
            }
          }
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(msg)),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Editar Perfil'),
        centerTitle: true,
        actions: [
          _isSaving
              ? const Padding(
                  padding: EdgeInsets.all(16),
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                )
              : TextButton(
                  onPressed: _saveProfile,
                  child: Text(
                    'Salvar',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.secondary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            // Avatar
            GestureDetector(
              onTap: _pickAvatar,
              child: Stack(
                children: [
                  CircleAvatar(
                    radius: 55,
                    backgroundImage: _newAvatar != null
                        ? FileImage(_newAvatar!)
                        : (widget.user.avatar != null
                            ? CachedNetworkImageProvider(widget.user.avatar!)
                            : null) as ImageProvider?,
                    child: (_newAvatar == null && widget.user.avatar == null)
                        ? Text(
                            widget.user.nomeUsuario
                                .substring(0, 1)
                                .toUpperCase(),
                            style: const TextStyle(
                                fontSize: 40, fontWeight: FontWeight.bold),
                          )
                        : null,
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Theme.of(context).colorScheme.secondary,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.camera_alt,
                          color: Colors.white, size: 18),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Toque para alterar',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
            const SizedBox(height: 32),

            // Nome completo
            TextField(
              controller: _nameController,
              decoration: InputDecoration(
                labelText: 'Nome completo',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                prefixIcon: const Icon(Icons.person_outline),
              ),
            ),
            const SizedBox(height: 20),

            // Username
            TextField(
              controller: _usernameController,
              decoration: InputDecoration(
                labelText: 'Nome de usuário',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                prefixIcon: const Padding(
                  padding: EdgeInsets.only(left: 12, right: 0),
                  child: Text('@',
                      style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey)),
                ),
                prefixIconConstraints:
                    const BoxConstraints(minWidth: 36, minHeight: 0),
              ),
            ),
            const SizedBox(height: 20),

            // Data de Nascimento
            InkWell(
              onTap: _pickDate,
              borderRadius: BorderRadius.circular(12),
              child: InputDecorator(
                decoration: InputDecoration(
                  labelText: 'Data de nascimento',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.cake_outlined),
                ),
                child: Text(
                  _dataNascimento != null
                      ? DateFormat('dd/MM/yyyy').format(_dataNascimento!)
                      : 'Selecione...',
                  style: TextStyle(
                    fontSize: 16,
                    color: _dataNascimento != null
                        ? Colors.black87
                        : Colors.grey[500],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Bio (sem ícone)
            TextField(
              controller: _bioController,
              maxLines: 4,
              maxLength: 200,
              decoration: InputDecoration(
                labelText: 'Bio',
                hintText: 'Conte um pouco sobre você...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                alignLabelWithHint: true,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
