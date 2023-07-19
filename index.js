const { create, decryptMedia } = require('@wppconnect-team/wppconnect');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const bot = require('./mesage.json');

const venomOptions = {
  session: 'bot-session',
  keepLogged: true,
  puppeteer: {
    headless: true,
  },
  catchQR: (base64Qr, asciiQR, attempts) => {
    console.log('QR Code:', base64Qr); // Imprime o QR Code no terminal
    console.log('Tentativas:', attempts); // Número de tentativas para obter o QR Code
  },
  statusFind: (statusSession, session) => {
    console.log('Status Session:', statusSession); // Imprime o status da sessão
    console.log('Session name:', session); // Nome da sessão
  },
};
create(venomOptions)
  .then((client) => start(client))
  .catch((error) => console.log('Error:', error));

async function start(client) {
  var progress = {level1: 'inicio'};
  // var progress = {level1: 'menuInicial',
  //                 level2: 'anunciar',
  //                 level3: 'cadastrarAnuncioImagem'};
  var codPessoa = '';
  var codAnuncio = '';
  //var api = 'http://localhost:21012/';
  var api = 'http://auto-unity.kinghost.net:21044/';
  var countImage = 0;
  var pessoaTemp = '';
  await client.onMessage(async (message) => {
    if (message.fromMe) {
      return;
    } 
    const body = message.body.toLowerCase();

    console.log(progress);
    if (body == 'inicio' || progress.level1 == 'inicio'){
      progress = {level1: 'menuInicial'};
      await client.sendText(message.from, bot.inicio.pergunta);
    } 
    else if (progress.level1 == 'menuInicial') {
      if(!progress.level2){
        await menuIncial(message);
      }else if(progress.level2 == 'anunciar'){
        if(!progress.level3){
          if(message.body.toLowerCase() == 'sim'){
              await client.sendText(message.from, bot.pessoa.pergunta1);
              progress.level3 = 'consultarCpf';
          }else if(tirarAcento(message.body.toLowerCase()) == 'nao'){
              await client.sendText(message.from, bot.pessoa.pergunta2);
              await client.sendText(message.from, bot.pessoa.pergunta22);
              progress.level3 = 'cadastrarPessoa';
          }else{
            await client.sendText(message.from, bot.inicio.resposta1);
          }
        }else if(progress.level3 == 'consultarCpf'){
          await consultarCpf(message);
        }else if(progress.level3 == 'cadastrarPessoa'){
          if(message.body.toLowerCase() == 'sim'){
            await cadastarPessoa();
          }else if(tirarAcento(message.body.toLowerCase()) == 'nao'){
            await client.sendText(message.from, 'Insira a informações novamente');
            await client.sendText(message.from, bot.pessoa.pergunta22);
          }else{
            await validarPessoa(message);
          }
        }else if(progress.level3 == 'cadastrarAnuncio'){
          await cadastrarAnuncio(message);
        }else if(progress.level3 == 'cadastrarAnuncioImagem'){
          await cadastrarAnuncioImagem(message);
        }
      }else if(progress.level2 == 'removerAnuncio'){

      }
    }else{
      await client.sendText(message.from,`Desculpe não entendi, tente novamente ou digite 'inicio' para voltar ao menu inicial`);
    }
  });

  async function cadastrarAnuncio(message){
    const anuncio = tratarMensagem(message.body);
    try {
      var response = await axios.post(api+'parts',{
        customerId:codPessoa,
        title:anuncio['Titulo'],
        note:anuncio['Descrição'],
        value:anuncio['Valor']
      });
      await client.sendText(message.from, bot.anuncio.resposta1);
      progress.level3 = 'cadastrarAnuncioImagem';
      codAnuncio = response.data.Data.id;
      countImage = 0;
    } catch (error) {
      console.error('Erro na requisição:', error);
      await client.sendText(message.from,'Ocorreu um erro ao cadastrar, vamos tentar novamente?');
    }
  }
  async function cadastrarAnuncioImagem(message){
    if (message.isMedia || message.type === 'image' ) {
      try{
        var media = await client.decryptFile(message);
        countImage++;
        var main = countImage == 1 ? 'S' : 'N';
        await axios.post(api+'imageParts/update',{
          image:media.toString('base64'),
          ext:message.mimetype.split('/')[1],
          partId:codAnuncio,
          main: main,
          customerId: codPessoa
        });
      }catch (error) {
        console.error('Erro na requisição:', error);
        await client.sendText(message.from,'Ocorreu um erro ao chamar a API.');
      }
    }else if(message.body == 'ok'){
      await client.sendText(message.from,`Anuncio feito com sucesso, o codigo é #${codAnuncio}`);
    }else{
        client.sendText(message.from,`Envie uma imagem.`);
    }
  }
  
  async function consultarCpf(message){
    try {
      const response = await axios.get(api+'customers/getByCpf/'+message.body);
      const data = response.data.Data;
      if(data){
        await client.sendText(message.from,`Seu nome é: **${data.name}**`);
        codPessoa = data.id;
        await client.sendText(message.from, bot.anuncio.pergunta1);
        await client.sendText(message.from, bot.anuncio.pergunta11);
        progress.level3 = 'cadastrarAnuncio';
      }else{
        await client.sendText(message.from,'Não acho esse CPF');
      }
    } catch (error) {
      console.error('Erro na requisição:', error);
      await client.sendText(message.from,'Ocorreu um erro ao chamar a API.');
    }
  }
  async function validarPessoa(message){
    pessoaTemp = tratarMensagem(message.body);
  
      var cpf = validarCpf(pessoaTemp['CPF']);
      if(!cpf){
        await client.sendText(message.from,'CPF invalido');
        return;
      }
      if(pessoaTemp['CEP']){
        endereco = await buscarCep(pessoaTemp['CEP']);
        if(endereco){
          console.log(endereco);
          var msgEndereco = 'Cidade:'+endereco.data.localidade
          msgEndereco += '\nEstado:'+endereco.data.uf
          await client.sendText(message.from,msgEndereco);
          await client.sendText(message.from,'Seu endereço esta correto?');
          pessoaTemp['Cidade'] = endereco.data.localidade;
          pessoaTemp['Estado'] = endereco.data.uf;
        }else{
          await client.sendText(message.from,'Ocorreu um erro ao chamar a API Via Cep.');
        }
      }
  }
  async function cadastarPessoa() {
  console.log(pessoaTemp);
    try {
      var response = await axios.post(api+'customers',{
        name:pessoaTemp['Nome Completo'],
        document:pessoaTemp['CPF'],
        cell:pessoaTemp['Celular'],
        city:pessoaTemp['Cidade'],
        state:pessoaTemp['Estado']
      });
      await client.sendText(message.from, bot.pessoa.resposta2);
      await client.sendText(message.from, bot.anuncio.pergunta1);
      await client.sendText(message.from, bot.anuncio.pergunta11);
      progress.level3 = 'cadastrarAnuncio';
      const data = response.data.Data;
      codPessoa = data.id;
    } catch (error) {
      console.error('Erro na requisição:', error);
      
    }
  }

  async function buscarCep(cep){
    var url = "https://viacep.com.br/ws/"+cep+"/json/"
    try{
      return await axios.get(url);
    }catch (error) {
      console.error('Erro na requisição:', error);
    }
    
  }
  async function menuIncial(message) {
      if (message.body == '1') {
        await client.sendText(message.from, bot.inicio.resposta1);
        progress.level2 = 'anunciar';                            
      }else if (message.body == '2'){
        await client.sendText(message.from, bot.inicio.resposta2);
      }else if(message.body == '3'){
        await client.sendText(message.from, bot.inicio.resposta3);
      }
  }
  function tratarMensagem(mensagem){
    const regex = /([^:\n]+):\s*([\s\S]*?)(?=\n\S|$)/g;
    const valores = {};
  
    let match;
    while ((match = regex.exec(mensagem)) !== null) {
      const chave = match[1].trim();
      const valor = match[2].trim();
      valores[chave] = valor;
    }
    return valores;
  }
  function tirarAcento(palavra){
    const palavraComAcento = palavra;
    const palavraSemAcento = palavraComAcento.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return palavraSemAcento;
  }
  function validarCpf(cpf) {
    cpf = cpf.replace(/[^\d]/g, ''); // Remove caracteres não numéricos
  
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) {
      return false; // CPF com formato inválido ou com todos os dígitos iguais
    }
  
    const digitoVerificador1 = parseInt(cpf.charAt(9));
    const digitoVerificador2 = parseInt(cpf.charAt(10));
  
    const soma1 = cpf
      .slice(0, 9)
      .split('')
      .reduce((acumulador, valor, indice) => acumulador + parseInt(valor) * (10 - indice), 0);
  
    const resto1 = soma1 % 11;
    const resultado1 = resto1 < 2 ? 0 : 11 - resto1;
  
    if (resultado1 !== digitoVerificador1) {
      return false; // Primeiro dígito verificador inválido
    }
  
    const soma2 = cpf
      .slice(0, 10)
      .split('')
      .reduce((acumulador, valor, indice) => acumulador + parseInt(valor) * (11 - indice), 0);
  
    const resto2 = soma2 % 11;
    const resultado2 = resto2 < 2 ? 0 : 11 - resto2;
  
    if (resultado2 !== digitoVerificador2) {
      return false; // Segundo dígito verificador inválido
    }
  
    return cpf; // CPF válido
  }
}