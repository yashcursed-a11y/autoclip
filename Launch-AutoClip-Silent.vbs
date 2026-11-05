Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c Launch-AutoClip.bat", 0, False
Set WshShell = Nothing
