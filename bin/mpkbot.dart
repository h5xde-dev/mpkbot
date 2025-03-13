import 'dart:convert';
import 'dart:io' as io;
import 'package:dotenv/dotenv.dart';
import 'package:http/http.dart' as http;
import 'package:intl/date_symbol_data_local.dart';
import 'package:schedules/schedules.dart';
import 'package:teledart/model.dart';
import 'package:intl/intl.dart';
import 'package:teledart/teledart.dart';
import 'package:teledart/telegram.dart';

// Константы
const String scheduleUrl = 'https://xn--80agvfr.xn--p1ai/students/schedule/teachers_schedule/open_json.php';

extension StringExtension on String {
    String capitalize() {
      return "${this[0].toUpperCase()}${this.substring(1).toLowerCase()}";
    }
}

void main() async {

  DotEnv env = DotEnv(includePlatformEnvironment: true)..load();

  final String botToken = env['TELEGRAM_BOT']!;

  await initializeDateFormatting('ru_RU', null);

  // Создаем экземпляр Telegram и Teledart
  final telegram = Telegram(botToken);
  final teledart = TeleDart(botToken, Event(''));


  // Every other day, beginning on January 1, 2023.
  final daily = Daily(
    startDate: DateTime(2025, 01, 01),
    frequency: 1,
  );

  var currentDate = DateTime.now();

  if(daily.occursOn(currentDate)){
    List<io.FileSystemEntity> dir = await io.Directory('secret').list().toList();

    for (var file in dir) {
      if(file.path.contains('db_')){
        Map data = json.decode(await io.File(file.path).readAsString());
        String chatId = data.entries.first.key;
        Map user = data.entries.first.value;

        if(user['teacher'] != null){
          String? result = await findSchedule(chatId.toString(), user['teacher']);

          // Создаем Inline-кнопки
          final inlineKeyboard = InlineKeyboardMarkup(inlineKeyboard: [
            [
              InlineKeyboardButton(text: 'Показать расписание', callbackData: 'scheduller'),
            ],
          ]);

          // Отправляем сообщение в чат пользователя
          await teledart.sendMessage(
            chatId,
            result!,
            parseMode: 'html',
            replyMarkup: inlineKeyboard
          );
        }
      }
    }
  }

  // Обработка нажатий на Inline-кнопки
  teledart.onCallbackQuery().listen((callbackQuery) async {
    final chatId = callbackQuery.from.id;
    final data = callbackQuery.data;

    // Отправляем ответ в зависимости от нажатой кнопки
    switch (data) {
      case 'scheduller':
        final Map<String, dynamic> userChatIds = json.decode(await io.File('secret/db_$chatId.json').readAsString());
        if(userChatIds[chatId.toString()]['teacher'] != null){
          String? result = await findSchedule(chatId.toString(), userChatIds[chatId.toString()]['teacher']);

          // Создаем Inline-кнопки
          final inlineKeyboard = InlineKeyboardMarkup(inlineKeyboard: [
            [
              InlineKeyboardButton(text: 'Показать расписание', callbackData: 'scheduller'),
            ],
          ]);

          // Отправляем сообщение в чат пользователя
          await teledart.sendMessage(
            chatId,
            result!,
            parseMode: 'html',
            replyMarkup: inlineKeyboard
          );
          
          return;
        }
        break;
      default:
        await teledart.sendMessage(chatId, 'Неизвестная команда');
    }
  });

  // Обработка команды /start
  teledart.onMessage(entityType: 'bot_command', keyword: 'start').listen((message) async {
    final chatId = message.chat.id;
    final username = message.chat.username ?? 'User';

    bool dbExisted = io.File('secret/db_$chatId.json').existsSync();

    if(!dbExisted){
      io.File('secret/db_$chatId.json').writeAsStringSync('{}');
    }
    final Map<String, dynamic> userChatIds = json.decode(io.File('secret/db_$chatId.json').readAsStringSync());
    // Сохраняем chatId пользователя
    if(userChatIds[chatId.toString()] == null){
      userChatIds[chatId.toString()] = {
        'name': username
      };
      io.File('secret/db_$chatId.json').writeAsString(json.encode(userChatIds));
    }

    // Отправляем приветственное сообщение
    await teledart.sendMessage(
      chatId,
      'Привет, $username! Напишите ваше имя в преподовательской базе, например Иванов А.В.',
    );

    print('Пользователь $username (chatId: $chatId) начал диалог.');
  });

  // Обработка команды /send
  teledart.onMessage(entityType: '*').listen((message) async {
    final chatId = message.chat.id;

    final Map<String, dynamic> userChatIds = json.decode(await io.File('secret/db_$chatId.json').readAsString());
    // Проверяем, есть ли пользователь в хранилище
    if (userChatIds.containsKey(chatId.toString())) {

      List? teachers = await fetchTeachers();

      if(teachers!.contains(message.text)){

        String? teacher = teachers.firstWhere((v) => v == message.text);

        // Сохраняем chatId пользователя
        if(userChatIds[chatId.toString()]['teacher'] == null){
          userChatIds[chatId.toString()] = {
            'name': message.chat.username!,
            'teacher': teacher!
          };
          io.File('secret/db_$chatId.json').writeAsStringSync(json.encode(userChatIds));
        }

        // Создаем Inline-кнопки
        final inlineKeyboard = InlineKeyboardMarkup(inlineKeyboard: [
          [
            InlineKeyboardButton(text: 'Показать расписание', callbackData: 'scheduller'),
          ],
        ]);

        // Отправляем сообщение в чат пользователя
        await teledart.sendMessage(
          chatId,
          'Теперь показывается расписание только для $teacher',
          replyMarkup: inlineKeyboard
        );
      }

      
    }
  });
  // Запуск бота
  teledart.start();
}

Future<String?> findSchedule(String chatId, String username) async {
  // Получаем текущий день недели
  String currentDay = DateFormat('EEEE', 'ru_RU').format(DateTime.now());
  String nextDay = DateFormat('EEEE', 'ru_RU').format(DateTime.now().add(Duration(days: 1)));

  // Парсим расписание
  Map? teacherSchedule = await fetchSchedule(username);

  String heading = "Сегодня пар нет";
  String heading2 = "Завтра пар нет";

  if(teacherSchedule != null){
    Map currData = teacherSchedule['rs'][currentDay.capitalize()];
    if(currData.isNotEmpty){
      String firstTime = currData.entries.first.key.toString().split('\n').first;
      String lastTime = currData.entries.last.key.toString().split('\n').last;
      
      heading = "<b>${currentDay.capitalize()}: $firstTime c $lastTime</b> \n";
    }

    Map nextData = teacherSchedule['rs'][nextDay.capitalize()];
    if(nextData.isNotEmpty){
      String first2Time = nextData.entries.first.key.toString().split('\n').first;
      String last2Time = nextData.entries.last.key.toString().split('\n').last;
      
      heading2 = "<b>${nextDay.capitalize()}: $first2Time c $last2Time</b> \n";
    }

    String formattedSchedule = formatSchedule(teacherSchedule['rs'], username);

    // Отправляем сообщение в Telegram
    if (teacherSchedule.isNotEmpty) {

      return '$heading$heading2\n\n$formattedSchedule';
    } else {
      return 'Расписание для преподавателя $username на $currentDay не найдено.';
    }
  }

  return null;
}

String formatSchedule(Map<String, dynamic> jsonData, String teacherName) {
  String result = '';

  // Перебор дней недели
  jsonData.forEach((day, lessons) {
    result += '<u><b>$day</b></u>:\n';

    // Перебор занятий в этот день
    for (var lessonsEntries in lessons.entries.toList()) {
      for (var lesson in lessonsEntries.value) {
        result += '-- (<b>${lessonsEntries.key.split('\n').join('-')})</b> Группа ${lesson['group']}: "${lesson['lesson'].replaceAll('\n',' ').replaceAll(teacherName,'').trim()}" в кабинете ${lesson['class']}\n';  
      }
      
    }
  });

  result += '';

  return result;
}

// Функция для получения расписания с сайта
Future<List?> fetchTeachers() async {
  bool dbExisted = io.File('secret/teachers.json').existsSync();

  if(dbExisted){
    List res = json.decode(io.File('secret/teachers.json').readAsStringSync());
    return res;
  }

  final response = await http.post(Uri.parse(scheduleUrl), headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },body: {
    'type': "1"
  });
  if (response.statusCode == 200) {

    Map data = json.decode(response.body);    
    io.File('secret/teachers.json').writeAsString(json.encode(data['rs']));

    return data['rs'];

  } else {
    throw Exception('Не удалось загрузить расписание');
  }
}

// Функция для получения расписания с сайта
Future<Map?> fetchSchedule(String teacherName) async {
  final response = await http.post(Uri.parse(scheduleUrl), headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },body: {
    'type': "2",
    'teacher': teacherName
  });
  if (response.statusCode == 200) {

    Map data = json.decode(response.body);
    
    return data;
  } else {
    throw Exception('Не удалось загрузить расписание');
  }
}