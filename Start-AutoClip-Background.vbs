Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\intel\Documents\Codex\2026-11-02\im-x20"

' Test if AutoClip is already responding on 4173
On Error Resume Next
Set http = CreateObject("MSXML2.ServerXMLHTTP.6.0")
http.setTimeouts 500, 500, 500, 500
http.open "GET", "http://127.0.0.1:4173/api/jobs", False
http.send ""

If Err.Number <> 0 Then
    ' Server not responding; launch node.exe hidden in background
    Err.Clear
    WshShell.Run """C:\Program Files\nodejs\node.exe"" server.js", 0, False
End If
