import 'package:flutter_test/flutter_test.dart';
import 'package:pubstore/main.dart';

void main() {
  testWidgets('App boots', (tester) async {
    await tester.pumpWidget(const PubstoreApp());
    expect(find.byType(PubstoreApp), findsOneWidget);
  });
}
