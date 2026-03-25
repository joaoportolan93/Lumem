import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:dreamshare/services/community_service.dart';

class RuleInput {
  String title = '';
  String description = '';
}

class CreateCommunityScreen extends StatefulWidget {
  const CreateCommunityScreen({super.key});

  @override
  _CreateCommunityScreenState createState() => _CreateCommunityScreenState();
}

class _CreateCommunityScreenState extends State<CreateCommunityScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _descController = TextEditingController();

  XFile? _imageFile;
  final List<RuleInput> _rules = [];
  bool _isLoading = false;

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 50,
      maxWidth: 1024,
    );
    if (pickedFile != null) {
      setState(() {
        _imageFile = pickedFile;
      });
    }
  }

  void _addRule() {
    setState(() {
      _rules.add(RuleInput());
    });
  }

  void _removeRule(int index) {
    setState(() {
      _rules.removeAt(index);
    });
  }

  Widget _buildPickerPlaceholder() {
    return Container(
      height: 120,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark
            ? Colors.grey[900]
            : Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[400]!),
      ),
      child: const Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.camera_alt, size: 40, color: Colors.grey),
          SizedBox(height: 8),
          Text('Tocar para escolher foto', style: TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() => _isLoading = true);

    final List<Map<String, String>> rulesData = _rules
        .where((r) => r.title.isNotEmpty)
        .map((r) => {'titulo': r.title, 'descricao': r.description})
        .toList();

    final formDataMap = {
      'nome': _nameController.text.trim(),
      'descricao': _descController.text.trim(),
      'regras': jsonEncode(rulesData),
    };

    final formData = FormData.fromMap(formDataMap);

    if (_imageFile != null) {
      final bytes = await _imageFile!.readAsBytes();
      final filename = _imageFile!.name.isNotEmpty ? _imageFile!.name : 'community.jpg';
      formData.files.add(MapEntry(
        'imagem',
        MultipartFile.fromBytes(bytes, filename: filename),
      ));
    }

    final communityService = CommunityService();
    final newCommunity = await communityService.createCommunity(formData);

    setState(() => _isLoading = false);

    if (newCommunity != null && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Comunidade criada com sucesso!'), backgroundColor: Colors.green),
      );
      Navigator.pop(context, true);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Erro ao criar comunidade. Verifique os dados.'), backgroundColor: Colors.red),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nova Comunidade'),
        actions: [
          _isLoading
              ? const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Center(child: SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))),
                )
              : TextButton(
                  onPressed: _submit,
                  child: Text('CRIAR', style: TextStyle(color: Theme.of(context).colorScheme.secondary, fontWeight: FontWeight.bold, fontSize: 16)),
                ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Conte-nos sobre sua comunidade',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'O nome e a descrição ajudam as pessoas a saber do que se trata sua comunidade.',
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 24),
              
              // Name Input
              TextFormField(
                controller: _nameController,
                maxLength: 21,
                decoration: InputDecoration(
                  labelText: 'Nome da Comunidade *',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'O nome é obrigatório';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),
              
              // Description Input
              TextFormField(
                controller: _descController,
                maxLines: 4,
                decoration: InputDecoration(
                  labelText: 'Descrição *',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'A descrição é obrigatória';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 24),

              // Image Selection
              const Text('Imagem da Comunidade', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              GestureDetector(
                onTap: _pickImage,
                child: _imageFile != null
                    ? Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(12),
                            child: Image.network(
                              _imageFile!.path,
                              height: 120,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              // Para web, path é uma URL object; no mobile usa file path
                              errorBuilder: (_, __, ___) => _buildPickerPlaceholder(),
                            ),
                          ),
                          const Positioned(
                            top: 8, right: 8,
                            child: CircleAvatar(
                              backgroundColor: Colors.black54,
                              child: Icon(Icons.edit, color: Colors.white, size: 18),
                            ),
                          ),
                        ],
                      )
                    : _buildPickerPlaceholder(),
              ),
              const SizedBox(height: 24),

              // Rules Section
              const Text('Regras da Comunidade', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _rules.length,
                itemBuilder: (context, index) {
                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              children: [
                                TextFormField(
                                  initialValue: _rules[index].title,
                                  onChanged: (val) => _rules[index].title = val,
                                  decoration: const InputDecoration(
                                    labelText: 'Título da Regra',
                                    isDense: true,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                TextFormField(
                                  initialValue: _rules[index].description,
                                  onChanged: (val) => _rules[index].description = val,
                                  maxLines: 2,
                                  decoration: const InputDecoration(
                                    labelText: 'Descrição da Regra (opcional)',
                                    isDense: true,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.red),
                            onPressed: () => _removeRule(index),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              
              OutlinedButton.icon(
                onPressed: _addRule,
                icon: const Icon(Icons.add),
                label: const Text('Adicionar Regra'),
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }
}
