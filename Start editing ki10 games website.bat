@echo off
echo Starting your Ki10 Games workspace...

:: Navigate to your project directory
cd C:\Users\markm\Desktop\My-Websites\ki10-games-website

:: Open the folder in VS Code in a new window
start "VSCode" code .

:: Open a new terminal window and start the Astro dev server
start "Astro Dev Server" cmd /k npm run dev