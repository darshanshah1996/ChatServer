const express=require('express');

const bpd=require('body-parser');
const morgan=require('morgan');
const { RateLimiterMemory } =require('rate-limiter-flexible');
const app=express();

const optsMessagePosts={
	points:1,
	duration:1

}
const optsGet={
	points:1,
	duration:10
}

const optsPost={
	points:5,
	duration:2
}

const rateLimiterMessagePosts =new RateLimiterMemory(optsMessagePosts);
const rateLimiterGet=new RateLimiterMemory(optsGet);
const rateLimiterPost=new RateLimiterMemory(optsPost);





let roomsStack={};


const server=app.listen(process.env.PORT||7000,()=>{
	console.log('listening on '+process.env.PORT||7000);
});




 





io=require('socket.io')(server,{
  cors: {
    origin: "*",
    methods: ["GET", "POST","PUT","UPDATE","DELETE"]
  }
});
app.use((req,res,next)=>{
	res.header('Access-Control-Allow-Origin','*');
	res.header('Access-Control-Allow-Headers','Origin,Accept ,Authorization,Content-Type,X-Requested-With,X-Auth-Token');
	if(req.method==='OPTIONS')
	{
		res.header('Access-Control-Allow-Methods','GET,PUT,POST,DELETE,UPDATE,OPTIONS');
	}
	next();
})


app.use(bpd.json());
app.use(bpd.urlencoded({extended:false}));
app.use(morgan('dev'));

app.get('/',async(req,res,next)=>{

	try{
          let ip=req.headers['X-Forwaded-For']|| req.connection.remoteAddress;
          console.log(ip); 

		await rateLimiterGet.consume(ip);
		res.status(200).send('Chat Server 1.0');
	}
	catch(err)
	{

       res.status(200).send('Too many request');
	}
	

})

app.post('Users',async(req,res)=>{
try{
let ip=req.headers['X-Forwaded-For']|| req.connection.remoteAddress;
          console.log(ip); 
      await rateLimiterPost.consume(ip);    
console.log(roomsStack);
let users=req.body.userAdded;
//console.log(users);
for(let user in users)
{
	
   if(roomsStack[user]===undefined)
   {
      users[user]=0;
   }
   
}
res.status(200).send({users});
}
catch(err)
{
res.status(200).send('Too many request');
}
})

io.on('connection',async (socket)=>{

  

    
	socket.on('addUser',(email)=>{
		roomsStack[email]=socket.id;
		
		io.to(roomsStack[email]).emit('UserAdded',{message:'User Added'+email});
		socket.broadcast.emit('Status',{email:email,status:1})
		
	})
	socket.on('removeUser',(email=>{
		//console.log('Removing User'+email);
		socket.broadcast.emit('Status',{email:email,status:0})
		delete roomsStack[email];
		socket.disconnect();
		//console.log(roomsStack);


	}))
	socket.on('disconnect',()=>{
		//console.log('Leaving');
		//console.log(socket.rooms);
	})




	socket.on('sendMessage',async (message)=>{
      try
      {
          await rateLimiterMessagePosts.consume(socket.handshake.address);
          

      // console.log(roomsStack);
       console.log(socket.handshake);		
		if(roomsStack[message['name']])
		{
			io.to(roomsStack[message['name']]).emit('reciveMessage',message);
		}
		else
		{
			io.to(roomsStack[message['from']]).emit('sendingFailed',message);
		}
     }
     catch(error)
     {
     	
     	socket.emit('Blocked','Too many messsages.Only 1 message permitted per second');
     }	
	})

	socket.on('sendPost',async(message)=>{
	try{
		await rateLimiterMessagePosts.consume(socket.handshake.address);
		socket.broadcast.emit('postUpdate',message);
	}	
	catch(error)
	{
		socket.emit('Blocked','Too many posts.Only 1 message permitted per second');
	}
		
	})

	socket.on('dumpStatus',(entry)=>{
       //console.log(entry);
		io.to(roomsStack[entry['toUser']]).emit('dumpUpdate',entry);
	})
  
 
})






