import 'package:flutter/material.dart';

class AppTheme {
  static const Color mintGreen = Color(0xFFCDEBDE);
  static const Color pistachio = Color(0xFFABD391);
  static const Color emerald = Color(0xFF5FDD9D);
  static const Color seaGreen = Color(0xFF499167);
  static const Color ebony = Color(0xFF505644);
  static const Color blackOlive = Color(0xFF3F4531);

  static const Color primaryColor = seaGreen;
  static const Color primaryVariant = blackOlive;
  static const Color secondary = emerald;

  static const Color accent = pistachio;
  static const Color accentVariant = mintGreen;

  static const Color success = seaGreen;
  static const Color warning = Color(0xFFFF9800);
  static const Color error = Color(0xFFF44336);
  static const Color info = emerald;

  static const Color background = mintGreen;
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceVariant = Color(0xFFF8FBF9);

  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color onSecondary = Color(0xFFFFFFFF);
  static const Color onBackground = blackOlive;
  static const Color onSurface = blackOlive;

  static const Color textPrimary = blackOlive;
  static const Color textSecondary = ebony;
  static const Color textHint = Color(0xFF9E9E9E);

  static const Color borderLight = mintGreen;
  static const Color borderMedium = pistachio;
  static const Color borderDark = seaGreen;

  static const Color crocodileGreen = seaGreen;
  static const Color crocodileAccent = emerald;
  static ColorScheme get colorScheme => const ColorScheme(
    brightness: Brightness.light,
    primary: primaryColor,
    onPrimary: onPrimary,
    secondary: secondary,
    onSecondary: onSecondary,
    error: error,
    onError: onPrimary,
    surface: surface,
    onSurface: onSurface,
    onSurfaceVariant: textSecondary,
    outline: borderMedium,
    outlineVariant: borderLight,
    surfaceContainerHighest: surfaceVariant,
  );
  static ThemeData get themeData => ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    appBarTheme: AppBarTheme(
      backgroundColor: primaryColor,
      foregroundColor: onPrimary,
      elevation: 2,
      centerTitle: true,
      titleTextStyle: TextStyle(
        color: onPrimary,
        fontSize: 20,
        fontWeight: FontWeight.w600,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: onPrimary,
        elevation: 2,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.bold),
      headlineMedium: TextStyle(
        color: textPrimary,
        fontWeight: FontWeight.w600,
      ),
      headlineSmall: TextStyle(color: textPrimary, fontWeight: FontWeight.w600),
      bodyLarge: TextStyle(color: textPrimary),
      bodyMedium: TextStyle(color: textPrimary),
      bodySmall: TextStyle(color: textSecondary),
      labelLarge: TextStyle(color: textPrimary, fontWeight: FontWeight.w500),
    ),
    cardTheme: CardTheme(
      color: surface,
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: primaryColor,
      contentTextStyle: TextStyle(color: onPrimary),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: borderMedium),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: borderLight),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: BorderSide(color: primaryColor, width: 2),
      ),
      filled: true,
      fillColor: surface,
    ),
  );
}
