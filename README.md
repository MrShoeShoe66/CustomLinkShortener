# CustomLinkShortener
A custom program to shorten urls 

## Local Setup
here is a simple guide to set this up localy or use it on your own hardware

### Install Dependancies 
to run the program locally you first need to install dependancies
using this command
`
npm install express express-basic-auth
`

### Run
to run either use
`npm start`
or
`node api/index.js`

## Remote Setup
To setup this program to run remotely, like on vercel for example, should work out of the box

simply use whatever commands needed to deploy on the software of your choice

## Usage
to be able to use the program at all, first check your domain settings to ensure your pointed to the correct server

to check this, just simply use the url and any unset domains will all forward to `https://example.com`

### Admin Login

to change this, go to the following url `https:// { YOUR DOMAIN } /admin` where YOUR DOMAIN is simply what it sounds like

then login with the default admin credentials:

Username: `admin`

Password: `password123`

### Domain Management
To add a domain to the software all you need to do is login to the admin page and navagate to the domains tab

in this tab you can enter any domain you want to use and set a default redirect link

the default redirect link will make it so if an invalid link is typed under that domain it will send you to that link

then simply hit the Add Domain button

 ---

to remove a domain dimply hit the delete button next to an existing domain

### Link Management
to add a link simply go to the links page of the admin settings 

then simply enter the short code (the bit after the base url), tartget url (where you want it to go), and select the domain you want to use

then simply hit save

---

to edit or delete a link, simply use the corosponding button

### Backups and Restores

to backup or restore any data, go to the settings or import/export pages and hit the export button
then save it in a file or location of your choice for later

to restore them, simply paste them in the same place you got the text from and hit import 