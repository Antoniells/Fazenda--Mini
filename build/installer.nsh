; Script extra do instalador do Mini Fazenda (NSIS, electron-builder o inclui sozinho a partir de `build/installer.nsh`).
;
; ATUALIZAR POR CIMA DA VERSÃO ANTERIOR: o instalador só remove a versão antiga que estiver no MESMO modo da tela "Instalar para
; todos os usuários / Só para mim". Quem tinha instalado "para todos" e escolhia "só para mim" (ou o contrário) ficava com as duas
; versões lado a lado. Aqui, se já existe uma instalação, o modo dela é usado sem perguntar — o instalador então desinstala a antiga
; (sem apagar os saves, que ficam em Documentos/Mini Fazenda) e instala a nova no mesmo lugar. Numa primeira instalação a pergunta
; continua. Se existirem as duas (de versões antigas), vale a de todos os usuários: nesse modo o instalador remove também a
; "só para mim".
!macro customInstallMode
!ifndef BUILD_UNINSTALLER
  ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $1 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${if} $0 != ""
    StrCpy $isForceMachineInstall "1"
  ${elseif} $1 != ""
    StrCpy $isForceCurrentInstall "1"
  ${endif}
!endif
!macroend
