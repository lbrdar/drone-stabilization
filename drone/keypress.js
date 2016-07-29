var keypress = require('keypress');

var stdin = process.openStdin(); 
require('tty').setRawMode(true);  

// make `process.stdin` begin emitting "keypress" events 
keypress(process.stdin);

//pocetno stanje dorna (ne leti)
var leti = 0; 
// listen for the "keypress" event 
process.stdin.on('keypress', function (ch, key) {
	if (key){
		switch(key.name){
			case 't': if(leti==0){client.takeoff(); leti=1;} break; //poleti
			case 'g': if(leti==1){client.land(); leti=0;}  break; //sleti
			case 'a': client.left(0.1); break; //ide u lijevo
			case 'd': client.right(0.1); break; //ide u desno
			case 'w': client.front(0.1); break; //ide naprijed
			case 's': client.back(0.1); break; //ide nazad
			case 'i': client.up(0.1); break; //ide gore
			case 'k': client.down(0.1); break; //ide dolje
			case 'l': client.clockwise(0.1); break; //rotacija desno
			case 'j': client.counterClockwise(0.1); break; //rotacija lijevo
			case 'c': exit(); break; //TODO: naci pravi exit xD
			default: break;
		}
	}
});