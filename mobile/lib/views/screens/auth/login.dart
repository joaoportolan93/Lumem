import 'package:flutter/material.dart';
import 'package:lottie/lottie.dart';
import 'package:lumem/util/animations.dart';
import 'package:lumem/util/const.dart';
import 'package:lumem/util/enum.dart';
import 'package:lumem/util/router.dart';
import 'package:lumem/util/validations.dart';
import 'package:lumem/views/screens/main_screen.dart';
import 'package:lumem/views/screens/onboarding.dart';
import 'package:lumem/views/widgets/custom_button.dart';
import 'package:lumem/views/widgets/custom_text_field.dart';
import 'package:lumem/util/extensions.dart';
import 'package:lumem/services/auth_service.dart';

class Login extends StatefulWidget {
  const Login({super.key});

  @override
  _LoginState createState() => _LoginState();
}

class _LoginState extends State<Login> {
  bool loading = false;
  bool validate = false;
  GlobalKey<FormState> formKey = GlobalKey<FormState>();
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  String email = '', password = '', name = '', username = '';
  String dataNascimentoStr = '';
  bool aceiteTermos = false;
  FocusNode nameFN = FocusNode();
  FocusNode usernameFN = FocusNode();
  FocusNode emailFN = FocusNode();
  FocusNode passFN = FocusNode();
  FormMode formMode = FormMode.LOGIN;
  final AuthService _authService = AuthService();

  Future<void> login() async {
    FormState form = formKey.currentState!;
    form.save();

    if (!form.validate()) {
      validate = true;
      setState(() {});
      return;
    }

    if (formMode == FormMode.REGISTER) {
      if (dataNascimentoStr.isEmpty || !aceiteTermos) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Por favor, informe a data de nascimento e aceite os termos.'),
            backgroundColor: Colors.red,
          ),
        );
        return;
      }
    }

    setState(() => loading = true);

    try {
      if (formMode == FormMode.LOGIN) {
        await _authService.login(email, password);
      } else if (formMode == FormMode.REGISTER) {
        await _authService.register(
          email: email,
          nomeUsuario: username,
          nomeCompleto: name,
          password: password,
          dataNascimento: dataNascimentoStr,
          aceiteTermos: aceiteTermos,
        );
      } else if (formMode == FormMode.FORGOT_PASSWORD) {
        // Mocking forgot password behavior
        if (mounted) {
          setState(() => loading = false);
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
                content: Text('Link de redefinição enviado para o email!')),
          );
          setState(() {
            formMode = FormMode.LOGIN;
          });
        }
        return;
      }
      if (mounted) {
        if (formMode == FormMode.REGISTER) {
          Navigate.pushPageReplacement(context, const Onboarding());
        } else {
          Navigate.pushPageReplacement(context, const MainScreen());
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => loading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString()),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    return Scaffold(
      key: _scaffoldKey,
      body: Row(
          children: [
            buildLottieContainer(),
            Expanded(
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 500),
                child: Center(
                  child: SingleChildScrollView(
                    padding:
                        EdgeInsets.symmetric(horizontal: screenWidth * 0.1),
                    child: buildFormContainer(),
                  ),
                ),
              ),
            ),
          ],
        ),
    );
  }

  buildLottieContainer() {
    final screenWidth = MediaQuery.of(context).size.width;
    return AnimatedContainer(
      width: screenWidth < 700 ? 0 : screenWidth * 0.5,
      duration: const Duration(milliseconds: 500),
      color: Theme.of(context).colorScheme.secondary.withValues(alpha: 0.3),
      child: Center(
        child: Lottie.asset(
          AppAnimations.chatAnimation,
          height: 400,
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  buildFormContainer() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: <Widget>[
        Text(
          Constants.appName,
          style: TextStyle(
            fontSize: 40.0,
            fontWeight: FontWeight.bold,
            color: Theme.of(context).textTheme.headlineLarge?.color,
          ),
        ).fadeInList(0, false),
        const SizedBox(height: 10),
        Text(
          'Compartilhe seus sonhos ✨',
          style: TextStyle(
            fontSize: 14,
            color: Theme.of(context).textTheme.bodySmall?.color ??
                Colors.grey[500],
          ),
        ),
        const SizedBox(height: 50.0),
        Form(
          autovalidateMode: AutovalidateMode.onUserInteraction,
          key: formKey,
          child: buildForm(),
        ),
        Visibility(
          visible: formMode == FormMode.LOGIN,
          child: Column(
            children: [
              const SizedBox(height: 10.0),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () {
                    formMode = FormMode.FORGOT_PASSWORD;
                    setState(() {});
                  },
                  style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.secondary,
                  ),
                  child: const Text('Esqueceu a senha?'),
                ),
              ),
            ],
          ),
        ).fadeInList(3, false),
        const SizedBox(height: 20.0),
        buildButton(),
        Visibility(
          visible: formMode == FormMode.LOGIN,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Não tem uma conta?'),
              TextButton(
                onPressed: () {
                  formMode = FormMode.REGISTER;
                  setState(() {});
                },
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.secondary,
                ),
                child: const Text('Cadastre-se'),
              ),
            ],
          ),
        ).fadeInList(5, false),
        Visibility(
          visible: formMode != FormMode.LOGIN,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text('Já tem uma conta?'),
              TextButton(
                onPressed: () {
                  formMode = FormMode.LOGIN;
                  setState(() {});
                },
                style: TextButton.styleFrom(
                  foregroundColor: Theme.of(context).colorScheme.secondary,
                ),
                child: const Text('Entrar'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  buildForm() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Visibility(
          visible: formMode == FormMode.REGISTER,
          child: Column(
            children: [
              CustomTextField(
                enabled: !loading,
                hintText: "Nome completo",
                textInputAction: TextInputAction.next,
                validateFunction: Validations.validateName,
                onSaved: (String? val) {
                  name = val ?? '';
                },
                focusNode: nameFN,
                nextFocusNode: usernameFN,
              ),
              const SizedBox(height: 20.0),
              CustomTextField(
                enabled: !loading,
                hintText: "Nome de usuário",
                textInputAction: TextInputAction.next,
                validateFunction: Validations.validateName,
                onSaved: (String? val) {
                  username = val ?? '';
                },
                focusNode: usernameFN,
                nextFocusNode: emailFN,
              ),
              const SizedBox(height: 20.0),
              GestureDetector(
                onTap: () async {
                  if (loading) return;
                  final DateTime? picked = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
                    firstDate: DateTime(1900),
                    lastDate: DateTime.now(),
                  );
                  if (picked != null) {
                    setState(() {
                      dataNascimentoStr = "${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
                    });
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 15),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(10.0),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.calendar_today, color: Theme.of(context).iconTheme.color),
                      const SizedBox(width: 10),
                      Text(dataNascimentoStr.isEmpty ? "Data de nascimento" : dataNascimentoStr),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20.0),
              CheckboxListTile(
              	value: aceiteTermos,
              	onChanged: loading ? null : (v) => setState(() => aceiteTermos = v ?? false),
              	title: const Text('Li e aceito os Termos de Uso e a Política de Privacidade', style: TextStyle(fontSize: 12)),
              	controlAffinity: ListTileControlAffinity.leading,
                contentPadding: EdgeInsets.zero,
              ),
              const SizedBox(height: 20.0),
            ],
          ),
        ),
        CustomTextField(
          enabled: !loading,
          hintText: "Email",
          textInputAction: TextInputAction.next,
          validateFunction: Validations.validateEmail,
          onSaved: (String? val) {
            email = val ?? '';
          },
          focusNode: emailFN,
          nextFocusNode: passFN,
        ).fadeInList(1, false),
        Visibility(
          visible: formMode != FormMode.FORGOT_PASSWORD,
          child: Column(
            children: [
              const SizedBox(height: 20.0),
              CustomTextField(
                enabled: !loading,
                hintText: "Senha",
                textInputAction: TextInputAction.done,
                validateFunction: Validations.validatePassword,
                submitAction: login,
                obscureText: true,
                onSaved: (String? val) {
                  password = val ?? '';
                },
                focusNode: passFN,
              ),
            ],
          ),
        ).fadeInList(2, false),
      ],
    );
  }

  buildButton() {
    return loading
        ? const Center(child: CircularProgressIndicator())
        : CustomButton(
            label: formMode == FormMode.LOGIN
                ? "Entrar"
                : formMode == FormMode.REGISTER
                    ? "Cadastrar"
                    : "Enviar",
            onPressed: () => login(),
          ).fadeInList(4, false);
  }
}
