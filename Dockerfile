FROM google/dart:latest

WORKDIR /app
COPY . .

RUN dart pub get
RUN dart compile exe bin/main.dart -o bin/main

CMD ["bin/main"]